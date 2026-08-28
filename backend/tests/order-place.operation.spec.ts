import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import moment from "moment-timezone";
import sinon, { createSandbox } from "sinon";

import BookHandover from "#models/book_handover";
import Match from "#models/match";
import MatchObligation from "#models/match_obligation";
import MatchParticipant from "#models/match_participant";
import { createTestRound } from "#tests/matches/match-testing-utils";
import { Signature } from "#models/mongoose/signature.schema";
import { OrderToCustomerItemGenerator } from "#services/legacy/collections/customer-item/helpers/order-to-customer-item-generator";
import { OrderPlacedHandler } from "#services/legacy/collections/order/helpers/order-placed-handler/order-placed-handler";
import { OrderValidator } from "#services/legacy/collections/order/helpers/order-validator/order-validator";
import { OrderPlaceOperation } from "#services/legacy/collections/order/operations/place/order-place.operation";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { BlapiResponse } from "#shared/blapi-response";
import { Order } from "#shared/order/order";
import { OrderItem } from "#shared/order/order-item/order-item";
import { SIGNATURE_NUM_MONTHS_VALID } from "#shared/serialized-signature";
import { UserDetail } from "#shared/user-detail";
import { mock } from "#tests/test-doubles";

test.group("OrderPlaceOperation", (group) => {
  const orderToCustomerItemGenerator = new OrderToCustomerItemGenerator();
  const orderPlacedHandler = new OrderPlacedHandler();
  const orderValidator = new OrderValidator();

  const orderPlaceOperation = new OrderPlaceOperation(
    orderToCustomerItemGenerator,
    orderPlacedHandler,
    orderValidator,
  );

  let placeOrderStub: sinon.SinonStub;
  let getOrderStub: sinon.SinonStub;
  let aggregateCustomerItemsStub: sinon.SinonStub;
  let getManyCustomerItemsStub: sinon.SinonStub;
  let generateCustomerItemStub: sinon.SinonStub;
  let validateOrderStub: sinon.SinonStub;
  let getUserDetailStub: sinon.SinonStub;
  let getSignatureStub: sinon.SinonStub;
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
    placeOrderStub = sandbox.stub(orderPlacedHandler, "placeOrder");
    getOrderStub = sandbox.stub(StorageService.Orders, "get");
    sandbox.stub(StorageService.CustomerItems, "get");
    aggregateCustomerItemsStub = sandbox.stub(StorageService.CustomerItems, "aggregate");
    getManyCustomerItemsStub = sandbox.stub(StorageService.CustomerItems, "getMany");
    generateCustomerItemStub = sandbox.stub(orderToCustomerItemGenerator, "generate");
    validateOrderStub = sandbox.stub(orderValidator, "validate");
    getUserDetailStub = sandbox.stub(StorageService.UserDetails, "get");
    getSignatureStub = sandbox.stub(StorageService.Signatures, "get");
  });
  group.each.teardown(() => {
    sandbox.restore();
  });
  group.each.setup(() => testUtils.db().truncate());

  const validOrder: Order = {
    id: "validOrder1",
    amount: 100,

    orderItems: [
      {
        type: "buy",
        item: "item1",
        title: "signatur 3",
        amount: 100,
        unitPrice: 100,
        blid: "blid1",
        handout: true,
        info: {},
        delivered: false,
        customerItem: "customerItem1",
      },
    ],
    branch: "branch1",
    customer: "customer1",
    byCustomer: false,
    employee: "employee1",
    placed: false,
    payments: ["payment1"],
    delivery: "delivery1",
  };

  const userDetailWithSignatures: UserDetail = {
    name: "",
    email: "",
    phone: "",
    address: "",
    postCode: "",
    postCity: "",
    dob: new Date(),
    signatures: ["validSignature"],
    id: "customer1",
    blid: "",
  };

  const validSignature: Signature = {
    image: Buffer.from("test"),
    signingName: "",
    signedByGuardian: true,
    id: "validSignature",
    creationTime: moment()
      .subtract(SIGNATURE_NUM_MONTHS_VALID / 2, "months")
      .toDate(),
  };

  test("should reject if order is not found", async ({ assert }) => {
    getOrderStub.rejects(new BlError('order "randomOrder" not found'));

    return assert.rejects(
      () => orderPlaceOperation.run({ documentId: "randomOrder" }),
      /order "randomOrder" not found/,
    );
  });

  test("should reject if orderPlacedHandler.placeOrder rejects", async ({ assert }) => {
    getOrderStub.resolves(validOrder);
    placeOrderStub.rejects(new BlError("order could not be placed"));
    getManyCustomerItemsStub.resolves([]);
    aggregateCustomerItemsStub.resolves([]);
    getUserDetailStub.resolves(userDetailWithSignatures);
    getSignatureStub.resolves(validSignature);

    await assert.rejects(() =>
      orderPlaceOperation.run({
        documentId: validOrder.id,
        user: { id: "user1", permission: "admin", details: "" },
      }),
    );
  });

  test("should reject if orderValidator.validate rejects", async ({ assert }) => {
    getOrderStub.resolves(validOrder);
    placeOrderStub.resolves({});
    validateOrderStub.rejects(new BlError("order not valid!"));
    getManyCustomerItemsStub.resolves([]);
    aggregateCustomerItemsStub.resolves([]);
    getSignatureStub.resolves(validSignature);
    getUserDetailStub.resolves(userDetailWithSignatures);

    return assert.rejects(() =>
      orderPlaceOperation.run({
        documentId: validOrder.id,
        user: { id: "user1", permission: "admin", details: "" },
      }),
    );
  });

  test("should resolve if order is valid", async ({ assert }) => {
    getManyCustomerItemsStub.resolves([]);
    const order = mock<Order>({
      id: "validOrder1",
      customer: "customer1",
      amount: 100,
      orderItems: [
        {
          type: "buy",
          amount: 100,
        },
      ],
    });

    getOrderStub.resolves(order);
    generateCustomerItemStub.resolves([]);
    placeOrderStub.resolves(order);
    validateOrderStub.resolves(true);
    getSignatureStub.resolves(validSignature);
    getUserDetailStub.resolves(userDetailWithSignatures);

    const result = await orderPlaceOperation.run({
      documentId: validOrder.id,
      user: { id: "user1", permission: "admin", details: "" },
    });

    assert.deepEqual(result, new BlapiResponse([order]));
  });

  /*
   * Stand movements are handovers with the stand on one side. These replace the four arrays of
   * blids and item ids the operation used to append to.
   */

  const CUSTOMER = "5d765db5fc8c47001c408d81";
  const ITEM = "5d765db5fc8c47001c408e01";
  const BLID = "BL0001234567";

  /** One obligation between the customer and the stand, in the direction given. */
  async function seedStandObligation(direction: "delivers" | "collects") {
    // Discharges only land on active rounds; a defaulted "draft" round would hide the obligation.
    const round = await createTestRound({
      name: "Round",
      standLocation: "Kantina",
      status: "active",
    });
    const match = await Match.create({ roundId: round.id, meetingLocation: "Kantina" });
    const [customer, stand] = await MatchParticipant.createMany([
      { matchId: match.id, userDetailId: CUSTOMER },
      { matchId: match.id, userDetailId: null },
    ]);
    return MatchObligation.create({
      matchId: match.id,
      senderParticipantId: direction === "delivers" ? customer!.id : stand!.id,
      receiverParticipantId: direction === "delivers" ? stand!.id : customer!.id,
      itemId: ITEM,
    });
  }

  function stubStandOrder(orderItem: Partial<OrderItem>, customerItem: Record<string, unknown>) {
    const order = mock<Order>({
      id: "standOrder1",
      customer: CUSTOMER,
      byCustomer: false,
      amount: 0,
      orderItems: [{ item: ITEM, amount: 0, unitPrice: 0, ...orderItem }],
    });

    getOrderStub.resolves(order);
    getManyCustomerItemsStub.callsFake(async (ids: string[]) =>
      [customerItem].filter((candidate) => ids.includes(String(candidate["id"]))),
    );
    aggregateCustomerItemsStub.resolves([]);
    generateCustomerItemStub.resolves([]);
    placeOrderStub.resolves(order);
    validateOrderStub.resolves(true);
    getSignatureStub.resolves(validSignature);
    getUserDetailStub.resolves(userDetailWithSignatures);
    return order;
  }

  const asAdmin = { id: "user1", permission: "admin" as const, details: "" };

  test("records a stand return as a handover to the stand", async ({ assert }) => {
    const obligation = await seedStandObligation("delivers");
    const order = stubStandOrder(
      { type: "return", customerItem: "ci1" },
      { id: "ci1", customer: CUSTOMER, item: ITEM, blid: BLID },
    );

    await orderPlaceOperation.run({ documentId: order.id, user: asAdmin });

    const handovers = await BookHandover.all();
    assert.lengthOf(handovers, 1);
    assert.equal(handovers[0]!.fromUserDetailId, CUSTOMER);
    assert.isNull(handovers[0]!.toUserDetailId, "the stand is the destination");
    assert.equal(handovers[0]!.dischargesSenderObligationId, obligation.id);
    assert.isNull(handovers[0]!.dischargesReceiverObligationId);
  });

  test("records a stand handout as a handover from the stand", async ({ assert }) => {
    const obligation = await seedStandObligation("collects");
    const order = stubStandOrder(
      { type: "rent", handout: true, customerItem: "ci2", blid: BLID },
      { id: "ci2", customer: CUSTOMER, item: ITEM, blid: BLID },
    );

    await orderPlaceOperation.run({ documentId: order.id, user: asAdmin });

    const handovers = await BookHandover.all();
    assert.lengthOf(handovers, 1);
    assert.isNull(handovers[0]!.fromUserDetailId, "the stand is the origin");
    assert.equal(handovers[0]!.toUserDetailId, CUSTOMER);
    assert.equal(handovers[0]!.dischargesReceiverObligationId, obligation.id);
  });

  test("records a book that moves outside any match", async ({ assert }) => {
    const order = stubStandOrder(
      { type: "return", customerItem: "ci1" },
      { id: "ci1", customer: CUSTOMER, item: ITEM, blid: BLID },
    );

    await orderPlaceOperation.run({ documentId: order.id, user: asAdmin });

    const handovers = await BookHandover.all();
    assert.lengthOf(handovers, 1, "the chain of custody records it even with no obligation");
    assert.isNull(handovers[0]!.dischargesSenderObligationId);
  });

  test("records a stand return for a legacy book with no BL-ID", async ({ assert }) => {
    const obligation = await seedStandObligation("delivers");
    const order = stubStandOrder(
      { type: "return", customerItem: "ci1" },
      { id: "ci1", customer: CUSTOMER, item: ITEM },
    );

    await orderPlaceOperation.run({ documentId: order.id, user: asAdmin });

    const handovers = await BookHandover.all();
    assert.lengthOf(handovers, 1);
    assert.isNull(handovers[0]!.blid, "legacy copies without a blid cannot be chained");
    assert.equal(handovers[0]!.dischargesSenderObligationId, obligation.id);
  });
});
