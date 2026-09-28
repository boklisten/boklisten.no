import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import BookHandover from "#models/book_handover";
import type Order from "#models/order";
import type { NewOrderItem } from "#models/order";
import Signature, { SIGNATURE_NUM_MONTHS_VALID } from "#models/signature";
import Match from "#models/match";
import MatchObligation from "#models/match_obligation";
import MatchParticipant from "#models/match_participant";
import { createBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import {
  createTestRound,
  ensureUsers,
  seedTestCatalogue,
} from "#tests/matches/match-testing-utils";
import { OrderToCustomerItemGenerator } from "#services/customer_items/order_to_customer_item_generator";
import { OrderPlacedHandler } from "#services/orders/order_placed_handler";
import { OrderPlaceService } from "#services/orders/order_place_service";
import { OrderValidator } from "#services/orders/validation/order_validator";
import { BlError } from "#shared/bl-error";
import { fixtureId } from "#tests/fixtures";
import { createUser } from "#tests/user_fixtures";

const CUSTOMER_1 = fixtureId("c1");
const BRANCH = fixtureId("b1");

function createValidSignature() {
  return Signature.create({
    customerDetailsId: CUSTOMER_1,
    signingName: "",
    signedByGuardian: true,
    image: Buffer.from("test"),
    createdAt: DateTime.now().minus({ months: SIGNATURE_NUM_MONTHS_VALID / 2 }),
  });
}

function createValidOrder() {
  return createOrder({
    amount: 100,
    orderItems: [
      {
        type: "buy",
        itemId: "item1",
        amount: 100,
        unitPrice: 100,
        blid: "blid1",
        handout: true,
      },
    ],
    branchId: BRANCH,
    customerId: CUSTOMER_1,
    byCustomer: false,
    placed: false,
  });
}

test.group("OrderPlaceService", (group) => {
  const orderToCustomerItemGenerator = new OrderToCustomerItemGenerator();
  const orderPlacedHandler = new OrderPlacedHandler();
  const orderValidator = new OrderValidator();

  const orderPlaceService = new OrderPlaceService(
    orderToCustomerItemGenerator,
    orderPlacedHandler,
    orderValidator,
  );

  let placeOrderStub: sinon.SinonStub;
  let generateCustomerItemStub: sinon.SinonStub;
  let validateOrderStub: sinon.SinonStub;
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
    placeOrderStub = sandbox.stub(orderPlacedHandler, "placeOrder");
    generateCustomerItemStub = sandbox.stub(orderToCustomerItemGenerator, "createFor").resolves([]);
    validateOrderStub = sandbox.stub(orderValidator, "validate");
  });
  group.each.teardown(() => {
    sandbox.restore();
  });
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(seedTestCatalogue);
  group.each.setup(() => ensureUsers([CUSTOMER]));
  group.each.setup(async () => {
    await createItem({ id: "item1", title: "signatur 3", price: 100 });
    await createBranch({ id: BRANCH });
  });
  // An underage customer with a valid guardian signature in Postgres.
  group.each.setup(async () => {
    await createUser({ id: CUSTOMER_1 });
    await createValidSignature();
  });

  test("should reject if order is not found", async ({ assert }) =>
    assert.rejects(() => orderPlaceService.place("randomOrder"), /order "randomOrder" not found/));

  test("should reject if orderPlacedHandler.placeOrder rejects", async ({ assert }) => {
    const validOrder = await createValidOrder();
    placeOrderStub.rejects(new BlError("order could not be placed"));

    await assert.rejects(() =>
      orderPlaceService.place(validOrder.id, { id: "user1", permission: "admin" }),
    );
  });

  test("should reject if orderValidator.validate rejects", async ({ assert }) => {
    const validOrder = await createValidOrder();
    placeOrderStub.resolves({});
    validateOrderStub.rejects(new BlError("order not valid!"));

    return assert.rejects(() =>
      orderPlaceService.place(validOrder.id, { id: "user1", permission: "admin" }),
    );
  });

  test("should resolve if order is valid", async ({ assert }) => {
    const order = await createOrder({
      branchId: BRANCH,
      customerId: CUSTOMER_1,
      amount: 100,
      placed: false,
      orderItems: [{ type: "buy", itemId: "item1", amount: 100, unitPrice: 100 }],
    });

    placeOrderStub.callsFake((placing: Order) => Promise.resolve(placing));
    validateOrderStub.resolves(true);

    const result = await orderPlaceService.place(order.id, {
      id: "user1",
      permission: "admin",
    });

    assert.equal(result.id, order.id);
    assert.isTrue(placeOrderStub.calledOnce);
  });

  /*
   * Stand movements are handovers with the stand on one side. These replace the four arrays of
   * blids and item ids the service used to append to.
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

  async function stubStandOrder(
    orderItem: Partial<NewOrderItem> & Pick<NewOrderItem, "type">,
    customerItem: { id: string; blid?: string } | null,
  ) {
    if (customerItem) {
      await createCustomerItem({
        blid: null,
        ...customerItem,
        customerId: CUSTOMER,
        itemId: ITEM,
        handoutBranchId: BRANCH,
      });
    }
    const order = await createOrder({
      branchId: BRANCH,
      customerId: CUSTOMER,
      byCustomer: false,
      amount: 0,
      placed: false,
      orderItems: [{ itemId: ITEM, amount: 0, unitPrice: 0, ...orderItem }],
    });

    placeOrderStub.resolves(order);
    validateOrderStub.resolves(true);
    return order;
  }

  const asAdmin = { id: "user1", permission: "admin" as const, details: "" };

  test("records a stand return as a handover to the stand", async ({ assert }) => {
    const obligation = await seedStandObligation("delivers");
    const order = await stubStandOrder(
      { type: "return", customerItemId: "ci1" },
      { id: "ci1", blid: BLID },
    );

    await orderPlaceService.place(order.id, asAdmin);

    const handovers = await BookHandover.all();
    assert.lengthOf(handovers, 1);
    assert.equal(handovers[0]!.fromUserDetailId, CUSTOMER);
    assert.isNull(handovers[0]!.toUserDetailId, "the stand is the destination");
    assert.equal(handovers[0]!.dischargesSenderObligationId, obligation.id);
    assert.isNull(handovers[0]!.dischargesReceiverObligationId);
  });

  test("records a stand handout as a handover from the stand", async ({ assert }) => {
    const obligation = await seedStandObligation("collects");
    const order = await stubStandOrder({ type: "rent", handout: true, blid: BLID }, null);
    // Placement creates the customer item for the handout and points the line at it
    generateCustomerItemStub.callsFake(async (placing: Order) => {
      const created = await createCustomerItem({
        blid: BLID,
        customerId: CUSTOMER,
        itemId: ITEM,
        handoutBranchId: BRANCH,
      });
      placing.orderItems[0]!.customerItemId = created.id;
      return [created];
    });

    await orderPlaceService.place(order.id, asAdmin);

    const handovers = await BookHandover.all();
    assert.lengthOf(handovers, 1);
    assert.isNull(handovers[0]!.fromUserDetailId, "the stand is the origin");
    assert.equal(handovers[0]!.toUserDetailId, CUSTOMER);
    assert.equal(handovers[0]!.dischargesReceiverObligationId, obligation.id);
  });

  test("records a book that moves outside any match", async ({ assert }) => {
    const order = await stubStandOrder(
      { type: "return", customerItemId: "ci1" },
      { id: "ci1", blid: BLID },
    );

    await orderPlaceService.place(order.id, asAdmin);

    const handovers = await BookHandover.all();
    assert.lengthOf(handovers, 1, "the chain of custody records it even with no obligation");
    assert.isNull(handovers[0]!.dischargesSenderObligationId);
  });

  test("records a stand return for a legacy book with no BL-ID", async ({ assert }) => {
    const obligation = await seedStandObligation("delivers");
    const order = await stubStandOrder({ type: "return", customerItemId: "ci1" }, { id: "ci1" });

    await orderPlaceService.place(order.id, asAdmin);

    const handovers = await BookHandover.all();
    assert.lengthOf(handovers, 1);
    assert.isNull(handovers[0]!.blid, "legacy copies without a blid cannot be chained");
    assert.equal(handovers[0]!.dischargesSenderObligationId, obligation.id);
  });
});
