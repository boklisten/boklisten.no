import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import BadRequestException from "#exceptions/bad_request_exception";
import type CustomerItem from "#models/customer_item";
import Delivery from "#models/delivery";
import Order from "#models/order";
import type OrderItem from "#models/order_item";
import Signature from "#models/signature";
import User from "#models/user";
import { OrderHistoryService } from "#services/order_history_service";
import { RefundRequestService } from "#services/refund_request_service";
import { StandCartCheckoutService } from "#services/stand_cart/stand_cart_checkout_service";
import type { StandCartCheckoutRequest } from "#services/stand_cart/stand_cart_checkout_service";
import { StandCartLineResolver } from "#services/stand_cart/stand_cart_line_resolver";
import type {
  StandCartLineContext,
  StandCartResolution,
} from "#services/stand_cart/stand_cart_line_resolver";
import { StandCartPlacement } from "#services/stand_cart/stand_cart_placement";
import { StandCartRefund } from "#services/stand_cart/stand_cart_refund";
import { StorageService } from "#services/storage_service";
import { VippsPaymentService } from "#services/vipps/vipps_payment_service";
import type { Branch } from "#shared/branch";
import type { Item } from "#shared/item";
import type {
  StandCartLine,
  StandCartOption,
  StandCartSource,
  StandCartVippsRefund,
} from "#shared/stand_cart";
import { branchDto, createBranch } from "#tests/branch_fixtures";
import { createCustomerItem, customerItemDouble } from "#tests/customer_item_fixtures";
import { createDelivery } from "#tests/delivery_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { asStub, mock, unchecked } from "#tests/test-doubles";
import { createUser, userDouble } from "#tests/user_fixtures";

const NOW = new Date("2026-09-07T10:00:00.000Z");
const SEMESTER_END = "2026-12-20T00:00:00.000Z";
const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f01";
const BRANCH_ID = "5f7f7f7f7f7f7f7f7f7f7f11";
const ORDER_ID = "5f7f7f7f7f7f7f7f7f7f7f31";
const NEW_ORDER_ID = "5f7f7f7f7f7f7f7f7f7f7f39";
const CUSTOMER_ITEM_ID = "5f7f7f7f7f7f7f7f7f7f7f41";
const DELIVERY_ID = "5f7f7f7f7f7f7f7f7f7f7f51";
const EMPLOYEE = { detailsId: "5f7f7f7f7f7f7f7f7f7f7f7e", permission: "employee" as const };
const BLID = "12345678";

const item = mock<Item>({ id: "item1", title: "Sinus 1T", price: 500 });
const branch: Branch = branchDto({
  id: BRANCH_ID,
  name: "Ullern VGS",
  paymentResponsible: true,
  rentPeriods: [
    { type: "semester", date: new Date(SEMESTER_END), maxNumberOfPeriods: 1, percentage: 1 },
  ],
  extendPeriods: [
    {
      type: "semester",
      date: new Date(SEMESTER_END),
      maxNumberOfPeriods: 1,
      price: 100,
      percentage: null,
    },
  ],
});

const orderedItem = mock<OrderItem>({
  type: "rent",
  itemId: item.id,
  amount: 0,
  unitPrice: 0,
  handout: false,
  delivered: false,
  periodTo: DateTime.fromISO(SEMESTER_END),
  periodType: "semester",
});
const originalOrder = mock<Order>({
  id: ORDER_ID,
  customerId: CUSTOMER_ID,
  branchId: BRANCH_ID,
  orderItems: [orderedItem],
});

/** The rows every test's orders refer to: the cart branch, the people, the book. */
async function createWorld(): Promise<void> {
  await createBranch(branch);
  await createUser({ id: CUSTOMER_ID });
  await createUser({ id: EMPLOYEE.detailsId });
  await createItem({ id: item.id, title: item.title, price: item.price });
}

/** The orders the checkout created, beside the original order it moves books from. */
async function createdOrders(): Promise<Order[]> {
  return Order.query().whereNot("id", ORDER_ID);
}

async function createdOrder(): Promise<Order> {
  const [order, ...rest] = await createdOrders();
  if (!order || rest.length > 0) {
    throw new Error("expected exactly one new order");
  }
  return order;
}
const customerItemColumns = {
  id: CUSTOMER_ITEM_ID,
  itemId: item.id,
  blid: BLID,
  customerId: CUSTOMER_ID,
  type: "rent",
  deadline: DateTime.fromISO(SEMESTER_END),
  handoutBranchId: BRANCH_ID,
} satisfies Partial<CustomerItem>;
const customerItem = customerItemDouble(customerItemColumns);

const ORDER_SOURCE: StandCartSource = { kind: "order", orderId: ORDER_ID, itemId: item.id };

function rentOption(price = 0): StandCartOption {
  return {
    type: "rent",
    to: SEMESTER_END,
    periodType: "semester",
    price,
    available: true,
    monitored: false,
  };
}

function resolution(
  source: StandCartSource,
  options: StandCartOption[],
  line: Partial<StandCartLine> = {},
): StandCartResolution {
  const context: StandCartLineContext =
    source.kind === "order"
      ? { kind: "order", order: originalOrder, orderItem: orderedItem, item }
      : source.kind === "customerItem"
        ? { kind: "customerItem", customerItem, item, handoutBranch: branch }
        : { kind: "item", item };
  return {
    kind: "line",
    line: {
      key: "k",
      source,
      itemId: item.id,
      title: item.title,
      blid: source.kind === "customerItem" ? BLID : null,
      options,
      defaultOptionIndex: 0,
      unavailableReason: null,
      originalBranch: { id: BRANCH_ID, name: "Ullern VGS" },
      notes: [],
      ...line,
    },
    context,
  };
}

/** The default line, priced at 250 kr, for the tests where money changes hands. */
function paidLine(): StandCartCheckoutRequest["lines"][number] {
  return {
    source: ORDER_SOURCE,
    choice: { type: "rent", to: SEMESTER_END },
    blid: BLID,
    expectedPrice: 250,
  };
}

function request(overrides: Partial<StandCartCheckoutRequest> = {}): StandCartCheckoutRequest {
  return {
    customerId: CUSTOMER_ID,
    branchId: BRANCH_ID,
    lines: [
      {
        source: ORDER_SOURCE,
        choice: { type: "rent", to: SEMESTER_END },
        blid: BLID,
        expectedPrice: 0,
      },
    ],
    payment: null,
    delivery: null,
    notifyByEmail: true,
    confirmed: [],
    ...overrides,
  };
}

const CANCEL_LINE = {
  source: ORDER_SOURCE,
  choice: { type: "cancel" as const },
  expectedPrice: -250,
};

function cancelOption(): StandCartOption {
  return { type: "cancel", price: -250, available: true, monitored: false };
}

function vippsRefund(orderId: string, amount: number): StandCartVippsRefund {
  return { orderId, method: "vipps-epayment", amount };
}

test.group("StandCartCheckoutService.checkout", (group) => {
  let sandbox: sinon.SinonSandbox;
  let resolve: sinon.SinonStub;
  let paymentsAdd: sinon.SinonStub;
  let place: sinon.SinonStub;
  let plan: sinon.SinonStub;
  let sendRefundRequest: sinon.SinonStub;
  let vipps: {
    create: sinon.SinonStub;
    info: sinon.SinonStub;
    cancel: sinon.SinonStub;
    capture: sinon.SinonStub;
    refund: sinon.SinonStub;
  };

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    await createWorld();
    await createCustomerItem(customerItemColumns);
    await createOrder({
      id: ORDER_ID,
      customerId: CUSTOMER_ID,
      branchId: BRANCH_ID,
      orderItems: [{ itemId: item.id }],
    });
    sandbox = createSandbox();
    plan = sandbox.stub(StandCartRefund, "plan").resolves(null);
    sendRefundRequest = sandbox.stub(RefundRequestService, "send").resolves();
    resolve = sandbox
      .stub(StandCartLineResolver, "resolveWithContext")
      .resolves(resolution(ORDER_SOURCE, [rentOption()], { blid: BLID }));
    sandbox
      .stub(User, "find")
      .resolves(userDouble({ id: CUSTOMER_ID, name: "Ola", taskSignAgreement: false }));
    paymentsAdd = sandbox
      .stub(StorageService.Payments, "add")
      .resolves(unchecked({ id: "payment1" }));
    place = sandbox.stub(StandCartPlacement, "place").callsFake((order: Order) => {
      order.placed = true;
      return Promise.resolve(order);
    });
    sandbox.stub(OrderHistoryService, "getOne").resolves(unchecked({ id: NEW_ORDER_ID }));
    sandbox.stub(Signature, "validForCustomer").resolves(unchecked({}));
    sandbox.stub(Signature, "newestForCustomer").resolves(null);
    vipps = {
      create: sandbox.stub().resolves({ reference: NEW_ORDER_ID }),
      info: sandbox.stub().resolves({ state: "CREATED" }),
      cancel: sandbox.stub().resolves({}),
      capture: sandbox.stub().resolves({}),
      refund: sandbox.stub().resolves({}),
    };
    sandbox.stub(VippsPaymentService, "payment").value(vipps);
  });
  group.each.teardown(() => sandbox.restore());

  const checkout = (overrides: Partial<StandCartCheckoutRequest> = {}) =>
    StandCartCheckoutService.checkout(request(overrides), EMPLOYEE, NOW);

  test("re-resolves every line with the cart branch and the scanned blid", async ({ assert }) => {
    await checkout();
    assert.deepEqual(resolve.firstCall.args[0], {
      customerId: CUSTOMER_ID,
      branchId: BRANCH_ID,
      source: ORDER_SOURCE,
      blid: BLID,
    });
  });

  test("a free handout is stored as the employee's order on the cart branch and placed at once", async ({
    assert,
  }) => {
    const state = await checkout();
    const order = await createdOrder();
    assert.include(order.toDto(), {
      amount: 0,
      branchId: BRANCH_ID,
      customerId: CUSTOMER_ID,
      byCustomer: false,
      employeeId: EMPLOYEE.detailsId,
      // The stub stands in for placement, so the stored order is as checkout left it
      placed: false,
      notifyByEmail: true,
    });
    assert.equal(order.orderItems[0]?.blid, BLID);
    assert.equal(order.orderItems[0]?.movedFromOrderId, ORDER_ID);
    assert.isFalse(paymentsAdd.called);
    assert.equal(place.firstCall.args[0].id, order.id);
    assert.deepEqual(place.firstCall.args[1], EMPLOYEE);
    assert.equal(state.status, "placed");
    assert.equal(state.orderId, order.id);
    assert.isNotNull(state.order);
  });

  test("a cash payment is recorded for the full amount before the order is placed", async ({
    assert,
  }) => {
    resolve.resolves(resolution(ORDER_SOURCE, [rentOption(250)], { blid: BLID }));
    const state = await checkout({ payment: { method: "cash" }, lines: [paidLine()] });
    assert.include(paymentsAdd.firstCall.args[0], {
      method: "cash",
      amount: 250,
      order: (await createdOrder()).id,
      customer: CUSTOMER_ID,
      branch: BRANCH_ID,
      confirmed: false,
    });
    assert.isTrue(paymentsAdd.calledBefore(place));
    assert.equal(state.status, "paid");
  });

  test("a Vipps refund goes back on the traced transaction before the order is placed", async ({
    assert,
  }) => {
    resolve.resolves(resolution(ORDER_SOURCE, [cancelOption()]));
    plan.resolves({ kind: "vipps", refunds: [vippsRefund(ORDER_ID, 250)] });
    const state = await checkout({ lines: [CANCEL_LINE], payment: { method: "vipps-refund" } });
    const order = await createdOrder();
    assert.equal(order.amount, -250);
    assert.isTrue(vipps.refund.calledOnceWith(ORDER_ID, 25_000));
    assert.include(paymentsAdd.firstCall.args[0], {
      method: "vipps-epayment",
      amount: -250,
      order: order.id,
    });
    assert.isTrue(paymentsAdd.calledBefore(place));
    assert.isFalse(sendRefundRequest.called);
    assert.equal(state.status, "paid");
  });

  test("refuses a Vipps refund the plan says must be made by hand, before any order exists", async ({
    assert,
  }) => {
    resolve.resolves(resolution(ORDER_SOURCE, [cancelOption()]));
    plan.resolves({ kind: "manual", reasons: ["«Sinus 1T» ble betalt kontant"] });
    await assert.rejects(
      () => checkout({ lines: [CANCEL_LINE], payment: { method: "vipps-refund" } }),
      BadRequestException,
      /manuelt/,
    );
    assert.lengthOf(await createdOrders(), 0);
    assert.isFalse(vipps.refund.called);
  });

  test("drops the order when Vipps refuses the refund, so it can be registered by hand", async ({
    assert,
  }) => {
    resolve.resolves(resolution(ORDER_SOURCE, [cancelOption()]));
    plan.resolves({ kind: "vipps", refunds: [vippsRefund(ORDER_ID, 250)] });
    vipps.refund.rejects(new Error("boom"));
    await assert.rejects(
      () => checkout({ lines: [CANCEL_LINE], payment: { method: "vipps-refund" } }),
      BadRequestException,
      /manuelt/,
    );
    assert.lengthOf(await createdOrders(), 0);
    assert.isFalse(paymentsAdd.called);
    assert.isFalse(place.called);
  });

  test("a refund Vipps only partly made is placed with the rest left to the administrator", async ({
    assert,
  }) => {
    const otherOrderId = "5f7f7f7f7f7f7f7f7f7f7f32";
    resolve.resolves(resolution(ORDER_SOURCE, [{ ...cancelOption(), price: -650 }]));
    plan.resolves({
      kind: "vipps",
      refunds: [vippsRefund(ORDER_ID, 250), vippsRefund(otherOrderId, 400)],
    });
    vipps.refund.withArgs(otherOrderId).rejects(new Error("boom"));
    const state = await checkout({
      lines: [{ ...CANCEL_LINE, expectedPrice: -650 }],
      payment: { method: "vipps-refund" },
    });
    assert.include(paymentsAdd.firstCall.args[0], { method: "vipps-epayment", amount: -250 });
    assert.include(paymentsAdd.secondCall.args[0], { method: "bank-transfer", amount: -400 });
    assert.isTrue(place.calledOnce);
    assert.include(sendRefundRequest.firstCall.args[0], {
      employeeDetailsId: EMPLOYEE.detailsId,
      amount: 400,
      accountNumber: null,
      comment: null,
    });
    assert.equal(state.status, "paid");
  });

  test("a manual refund records a bank transfer and asks the administrator to make it", async ({
    assert,
  }) => {
    resolve.resolves(resolution(ORDER_SOURCE, [cancelOption()]));
    const state = await checkout({
      lines: [CANCEL_LINE],
      payment: {
        method: "bank-transfer",
        accountNumber: "1234.56.78903",
        comment: "Kunden har byttet skole",
      },
    });
    const order = await createdOrder();
    assert.include(paymentsAdd.firstCall.args[0], {
      method: "bank-transfer",
      amount: -250,
      order: order.id,
    });
    assert.isTrue(place.calledOnce);
    assert.isFalse(vipps.refund.called);
    assert.include(sendRefundRequest.firstCall.args[0], {
      employeeDetailsId: EMPLOYEE.detailsId,
      amount: 250,
      accountNumber: "12345678903",
      comment: "Kunden har byttet skole",
    });
    assert.equal(sendRefundRequest.firstCall.args[0].order.id, order.id);
    assert.equal(state.status, "paid");
  });

  test("refuses a manual refund with an invalid account number before any order exists", async ({
    assert,
  }) => {
    resolve.resolves(resolution(ORDER_SOURCE, [cancelOption()]));
    await assert.rejects(
      () =>
        checkout({
          lines: [CANCEL_LINE],
          payment: { method: "bank-transfer", accountNumber: "1234.56.78904", comment: null },
        }),
      BadRequestException,
      /kontonummer/i,
    );
    assert.lengthOf(await createdOrders(), 0);
  });

  test("refuses a refund by any method that is not a refund", async ({ assert }) => {
    resolve.resolves(resolution(ORDER_SOURCE, [cancelOption()]));
    await assert.rejects(
      () => checkout({ lines: [CANCEL_LINE], payment: { method: "vipps" } }),
      BadRequestException,
      /refusjon/i,
    );
    await assert.rejects(
      () => checkout({ lines: [CANCEL_LINE], payment: null }),
      BadRequestException,
      /refusjon/i,
    );
    assert.lengthOf(await createdOrders(), 0);
  });

  test("refuses a refund method when there is something to pay", async ({ assert }) => {
    resolve.resolves(resolution(ORDER_SOURCE, [rentOption(250)], { blid: BLID }));
    await assert.rejects(
      () => checkout({ lines: [paidLine()], payment: { method: "vipps-refund" } }),
      BadRequestException,
      /Velg betalingsmåte/,
    );
    assert.lengthOf(await createdOrders(), 0);
  });

  test("refuses when something is to be paid and no method was chosen", async ({ assert }) => {
    resolve.resolves(resolution(ORDER_SOURCE, [rentOption(250)], { blid: BLID }));
    await assert.rejects(
      () => checkout({ lines: [paidLine()] }),
      BadRequestException,
      /Velg betalingsmåte/,
    );
    assert.lengthOf(await createdOrders(), 0);
  });

  test("refuses a choice the line no longer offers, naming the book", async ({ assert }) => {
    await assert.rejects(
      () =>
        checkout({
          lines: [
            { source: ORDER_SOURCE, choice: { type: "buyout" }, blid: BLID, expectedPrice: 0 },
          ],
        }),
      BadRequestException,
      /«Sinus 1T».*ikke lenger tilgjengelig/,
    );
  });

  test("refuses a blocked option with its reason", async ({ assert }) => {
    resolve.resolves(
      resolution(ORDER_SOURCE, [
        { type: "cancel", price: 0, available: false, monitored: false, reason: "Låst" },
      ]),
    );
    await assert.rejects(
      () =>
        checkout({
          lines: [{ source: ORDER_SOURCE, choice: { type: "cancel" }, expectedPrice: 0 }],
        }),
      BadRequestException,
      /«Sinus 1T»: Låst/,
    );
  });

  test("passes a refused line's message on", async ({ assert }) => {
    resolve.resolves({ kind: "refused", message: "«Sinus 1T» er ikke lenger bestilt" });
    await assert.rejects(() => checkout(), BadRequestException, /ikke lenger bestilt/);
  });

  test("refuses a loan handout without a blid", async ({ assert }) => {
    resolve.resolves(resolution(ORDER_SOURCE, [rentOption()]));
    await assert.rejects(
      () =>
        checkout({
          lines: [
            { source: ORDER_SOURCE, choice: { type: "rent", to: SEMESTER_END }, expectedPrice: 0 },
          ],
        }),
      BadRequestException,
      /«Sinus 1T» må skannes/,
    );
  });

  test("refuses the same copy twice", async ({ assert }) => {
    resolve
      .onFirstCall()
      .resolves(resolution(ORDER_SOURCE, [rentOption()], { key: "a", blid: BLID }))
      .onSecondCall()
      .resolves(
        resolution({ kind: "item", itemId: item.id, blid: BLID }, [rentOption()], {
          key: "b",
          blid: BLID,
        }),
      );
    await assert.rejects(
      () =>
        checkout({
          lines: [
            {
              source: ORDER_SOURCE,
              choice: { type: "rent", to: SEMESTER_END },
              blid: BLID,
              expectedPrice: 0,
            },
            {
              source: { kind: "item", itemId: item.id, blid: BLID },
              choice: { type: "rent", to: SEMESTER_END },
              expectedPrice: 0,
            },
          ],
        }),
      BadRequestException,
      /Unik ID 12345678 er lagt til to ganger/,
    );
  });

  test("refuses a price that moved since the cart showed it, so the employee looks again", async ({
    assert,
  }) => {
    resolve.resolves(resolution(ORDER_SOURCE, [rentOption(250)], { blid: BLID }));
    await assert.rejects(
      () => checkout({ payment: { method: "cash" } }),
      BadRequestException,
      /«Sinus 1T» har fått ny pris/,
    );
    assert.lengthOf(await createdOrders(), 0);
  });

  test("refuses a blid that is not linked to any book", async ({ assert }) => {
    resolve.resolves({ kind: "unlinked", blid: BLID });
    await assert.rejects(() => checkout(), BadRequestException, /Unik ID 12345678 er ikke koblet/);
  });

  test("a book due from another student needs the employee's say-so", async ({ assert }) => {
    resolve.resolves(
      resolution(ORDER_SOURCE, [rentOption()], {
        blid: BLID,
        notes: [{ kind: "peer-match", deliverFromId: "peer-sender", deliverFromName: "Kari" }],
      }),
    );
    await assert.rejects(() => checkout(), BadRequestException, /Kari/);
    const state = await checkout({ confirmed: ["peer-match"] });
    assert.equal(state.status, "placed");
  });

  test("an employee cannot hand out a copy of a title the customer is holding", async ({
    assert,
  }) => {
    resolve.resolves(
      resolution(ORDER_SOURCE, [rentOption()], {
        blid: BLID,
        notes: [{ kind: "already-held", customerItemId: CUSTOMER_ITEM_ID, title: "Sinus 1T" }],
      }),
    );
    await assert.rejects(
      () => checkout({ confirmed: ["extra-copy"] }),
      BadRequestException,
      /^Kunden har allerede «Sinus 1T»\. Kontakt en administrator for å dele ut et ekstra eksemplar\.$/,
    );
    assert.lengthOf(await createdOrders(), 0);
  });

  test("an administrator hands out the extra copy, but only knowingly", async ({ assert }) => {
    resolve.resolves(
      resolution(ORDER_SOURCE, [rentOption()], {
        blid: BLID,
        notes: [{ kind: "already-held", customerItemId: CUSTOMER_ITEM_ID, title: "Sinus 1T" }],
      }),
    );
    const admin = { ...EMPLOYEE, permission: "admin" as const };
    await assert.rejects(
      () => StandCartCheckoutService.checkout(request(), admin, NOW),
      BadRequestException,
      /^Kunden har allerede «Sinus 1T»\. Bekreft at et ekstra eksemplar skal deles ut likevel\.$/,
    );
    const state = await StandCartCheckoutService.checkout(
      request({ confirmed: ["extra-copy"] }),
      admin,
      NOW,
    );
    assert.equal(state.status, "placed");
  });

  test("an employee cannot hand out two copies of one title in one cart", async ({ assert }) => {
    const secondSource: StandCartSource = { kind: "item", itemId: item.id, blid: "87654321" };
    resolve.callsFake((incoming: { source: StandCartSource }) =>
      Promise.resolve(
        incoming.source.kind === "item"
          ? resolution(secondSource, [rentOption()], { key: "k2", blid: "87654321" })
          : resolution(ORDER_SOURCE, [rentOption()], { blid: BLID }),
      ),
    );
    await assert.rejects(
      () =>
        checkout({
          lines: [
            {
              source: ORDER_SOURCE,
              choice: { type: "rent", to: SEMESTER_END },
              blid: BLID,
              expectedPrice: 0,
            },
            {
              source: secondSource,
              choice: { type: "rent", to: SEMESTER_END },
              blid: "87654321",
              expectedPrice: 0,
            },
          ],
        }),
      BadRequestException,
      /«Sinus 1T» ligger allerede i handlekurven/,
    );
  });

  test("a loan to a customer without a valid signature needs the employee's say-so", async ({
    assert,
  }) => {
    asStub(Signature.validForCustomer).resolves(null);
    asStub(User.find).resolves(
      userDouble({ id: CUSTOMER_ID, name: "Ola", taskSignAgreement: true }),
    );
    await assert.rejects(() => checkout(), BadRequestException, /signatur/);
    const state = await checkout({ confirmed: ["missing-signature"] });
    assert.equal(state.status, "placed");
  });

  /** The source order was sent by Bring, so the cart may send the new order the same way. */
  async function givenBringDelivery(price = 0) {
    await createDelivery({
      id: DELIVERY_ID,
      orderId: ORDER_ID,
      amount: 149,
      fromPostalCode: "0150",
      toPostalCode: "0151",
      facilityAddress: "Gata 1",
      facilityPostalCode: "0150",
      facilityPostalCity: "Oslo",
      shipmentName: "Ola",
      shipmentAddress: "Veien 2",
      shipmentPostalCode: "0151",
      shipmentPostalCity: "Oslo",
      product: "SERVICEPAKKE",
    });
    resolve.resolves({
      ...resolution(ORDER_SOURCE, [rentOption(price)], {
        blid: BLID,
        notes: [{ kind: "bring-delivery" }],
      }),
      context: { kind: "order", order: originalOrder, orderItem: orderedItem, item },
    });
  }

  test("sends the order by mail when the original order had a Bring delivery", async ({
    assert,
  }) => {
    await givenBringDelivery();

    await checkout({ delivery: { trackingNumber: "TR123" } });

    const order = await createdOrder();
    const delivery = await Delivery.ofOrder(order.id);
    assert.deepInclude(delivery?.toDto(), {
      orderId: order.id,
      method: "bring",
      amount: 0,
      branchId: null,
      bringAmount: 0,
      estimatedDelivery: null,
      facilityAddress: "Gata 1",
      facilityPostalCode: "0150",
      facilityPostalCity: "Oslo",
      shipmentName: "Ola",
      shipmentAddress: "Veien 2",
      shipmentPostalCode: "0151",
      shipmentPostalCity: "Oslo",
      fromPostalCode: "0150",
      toPostalCode: "0151",
      product: "SERVICEPAKKE",
      trackingNumber: "TR123",
    });
    assert.isTrue(place.calledOnce);
  });

  test("refuses a tracking number when nothing in the cart goes by mail", async ({ assert }) => {
    await assert.rejects(
      () => checkout({ delivery: { trackingNumber: "TR123" } }),
      BadRequestException,
      /Ingen av bestillingene skal sendes i posten/,
    );
  });

  test("a Vipps payment pushes a request and leaves the order pending", async ({ assert }) => {
    resolve.resolves(resolution(ORDER_SOURCE, [rentOption(250)], { blid: BLID }));
    const state = await checkout({
      lines: [paidLine()],
      payment: { method: "vipps", phoneNumber: "+47 912 34 567" },
    });
    const order = await createdOrder();
    assert.include(vipps.create.firstCall.args[0], {
      reference: order.id,
      userFlow: "PUSH_MESSAGE",
      customerInteraction: "CUSTOMER_PRESENT",
      paymentDescription: "Ola sin ordre fra Boklisten.no",
    });
    assert.deepEqual(vipps.create.firstCall.args[0].amount, { currency: "NOK", value: 25_000 });
    assert.deepEqual(vipps.create.firstCall.args[0].customer, { phoneNumber: "4791234567" });
    assert.isFalse(place.called);
    assert.equal(order.checkoutState, "SessionCreated");
    assert.equal(state.status, "pending");
    assert.equal(state.orderId, order.id);
    assert.isNull(state.order);
  });

  test("a number without a Vipps user is reported to the employee and the order is dropped", async ({
    assert,
  }) => {
    resolve.resolves(resolution(ORDER_SOURCE, [rentOption(250)], { blid: BLID }));
    vipps.create.rejects(new Error('{"type":"...","extraDetails":[{"name":"7010"}]}'));
    await assert.rejects(
      () =>
        checkout({ lines: [paidLine()], payment: { method: "vipps", phoneNumber: "91234567" } }),
      BadRequestException,
      /ikke registrert i Vipps/,
    );
    assert.lengthOf(await createdOrders(), 0);
  });

  test("a dropped order takes the delivery copied onto it along", async ({ assert }) => {
    await givenBringDelivery(250);
    vipps.create.rejects(new Error("boom"));
    await assert.rejects(
      () =>
        checkout({
          lines: [paidLine()],
          payment: { method: "vipps", phoneNumber: "91234567" },
          delivery: { trackingNumber: "TR123" },
        }),
      BadRequestException,
    );
    assert.lengthOf(await createdOrders(), 0);
    const deliveries = await Delivery.all();
    assert.deepEqual(
      deliveries.map((delivery) => delivery.orderId),
      [ORDER_ID],
    );
  });

  test("rejects a bad phone number before any order exists", async ({ assert }) => {
    resolve.resolves(resolution(ORDER_SOURCE, [rentOption(250)], { blid: BLID }));
    await assert.rejects(
      () => checkout({ lines: [paidLine()], payment: { method: "vipps", phoneNumber: "123" } }),
      BadRequestException,
    );
    assert.lengthOf(await createdOrders(), 0);
  });
});

test.group("StandCartCheckoutService.refundPlan", (group) => {
  let sandbox: sinon.SinonSandbox;
  let plan: sinon.SinonStub;

  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox
      .stub(StandCartLineResolver, "resolveWithContext")
      .resolves(
        resolution(ORDER_SOURCE, [
          { type: "cancel", price: -250, available: true, monitored: false },
        ]),
      );
    plan = sandbox.stub(StandCartRefund, "plan").resolves({ kind: "manual", reasons: ["x"] });
  });
  group.each.teardown(() => sandbox.restore());

  test("re-resolves the lines the way checkout does and returns their refund plan", async ({
    assert,
  }) => {
    const result = await StandCartCheckoutService.refundPlan(
      {
        customerId: CUSTOMER_ID,
        branchId: BRANCH_ID,
        lines: [{ source: ORDER_SOURCE, choice: { type: "cancel" }, expectedPrice: -250 }],
      },
      NOW,
    );
    assert.deepEqual(result, { kind: "manual", reasons: ["x"] });
    assert.equal(plan.firstCall.args[0][0].option.price, -250);
    assert.deepEqual(plan.firstCall.args[1], NOW);
  });

  test("refuses a line whose price moved, like checkout", async ({ assert }) => {
    await assert.rejects(
      () =>
        StandCartCheckoutService.refundPlan(
          {
            customerId: CUSTOMER_ID,
            branchId: BRANCH_ID,
            lines: [{ source: ORDER_SOURCE, choice: { type: "cancel" }, expectedPrice: -100 }],
          },
          NOW,
        ),
      BadRequestException,
      /har fått ny pris/,
    );
  });
});

test.group("StandCartCheckoutService.status and cancel", (group) => {
  let sandbox: sinon.SinonSandbox;
  let paymentsAdd: sinon.SinonStub;
  let place: sinon.SinonStub;
  let vipps: {
    create: sinon.SinonStub;
    info: sinon.SinonStub;
    cancel: sinon.SinonStub;
    capture: sinon.SinonStub;
  };

  /** Changes the stored pending order the way an earlier request would have. */
  const updatePendingOrder = (columns: Partial<Pick<Order, "placed" | "checkoutState">>) =>
    Order.query().where("id", NEW_ORDER_ID).update(columns);

  const checkoutStateOf = async () => (await Order.findOrFail(NEW_ORDER_ID)).checkoutState;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    await createWorld();
    await createCustomerItem(customerItemColumns);
    await createOrder({
      id: NEW_ORDER_ID,
      amount: 250,
      customerId: CUSTOMER_ID,
      branchId: BRANCH_ID,
      employeeId: EMPLOYEE.detailsId,
      placed: false,
      checkoutState: "SessionCreated",
      orderItems: [{ itemId: item.id, amount: 250, unitPrice: 250 }],
    });
    sandbox = createSandbox();
    paymentsAdd = sandbox
      .stub(StorageService.Payments, "add")
      .resolves(unchecked({ id: "payment1" }));
    place = sandbox.stub(StandCartPlacement, "place").callsFake((order: Order) => {
      order.placed = true;
      return Promise.resolve(order);
    });
    sandbox
      .stub(User, "find")
      .resolves(userDouble({ id: EMPLOYEE.detailsId, permission: "employee" }));
    sandbox.stub(OrderHistoryService, "getOne").resolves(unchecked({ id: NEW_ORDER_ID }));
    vipps = {
      create: sandbox.stub().resolves({}),
      info: sandbox.stub().resolves({ state: "CREATED" }),
      cancel: sandbox.stub().resolves({}),
      capture: sandbox.stub().resolves({}),
    };
    sandbox.stub(VippsPaymentService, "payment").value(vipps);
  });
  group.each.teardown(() => sandbox.restore());

  test("status reports a placed order as paid without asking Vipps again", async ({ assert }) => {
    await updatePendingOrder({ placed: true });
    const state = await StandCartCheckoutService.status(NEW_ORDER_ID);
    assert.equal(state.status, "paid");
    assert.isFalse(vipps.info.called);
  });

  test("status settles an approved request: payment recorded, order placed by its employee, funds captured", async ({
    assert,
  }) => {
    vipps.info.resolves({ state: "AUTHORIZED" });
    const state = await StandCartCheckoutService.status(NEW_ORDER_ID);
    assert.include(paymentsAdd.firstCall.args[0], { method: "vipps-epayment", amount: 250 });
    assert.deepEqual(place.firstCall.args[1], EMPLOYEE);
    assert.isTrue(vipps.capture.calledWith(NEW_ORDER_ID, 25_000));
    assert.equal(await checkoutStateOf(), "PaymentSuccessful");
    assert.equal(state.status, "paid");
    assert.isNotNull(state.order);
  });

  test("status keeps waiting while the customer has not answered", async ({ assert }) => {
    const state = await StandCartCheckoutService.status(NEW_ORDER_ID);
    assert.equal(state.status, "pending");
    assert.isFalse(place.called);
  });

  test("status remembers a declined request so the next poll does not ask Vipps", async ({
    assert,
  }) => {
    vipps.info.resolves({ state: "ABORTED" });
    const state = await StandCartCheckoutService.status(NEW_ORDER_ID);
    assert.equal(state.status, "aborted");
    assert.equal(await checkoutStateOf(), "PaymentTerminated");

    vipps.info.resetHistory();
    const again = await StandCartCheckoutService.status(NEW_ORDER_ID);
    assert.equal(again.status, "aborted");
    assert.isFalse(vipps.info.called);
  });

  test("status refuses an order that never waited for Vipps", async ({ assert }) => {
    await updatePendingOrder({ checkoutState: null });
    await assert.rejects(() => StandCartCheckoutService.status(NEW_ORDER_ID), BadRequestException);
  });

  test("cancel withdraws the pending request", async ({ assert }) => {
    const state = await StandCartCheckoutService.cancel(NEW_ORDER_ID);
    assert.isTrue(vipps.cancel.calledWith(NEW_ORDER_ID));
    assert.equal(state.status, "cancelled");
  });

  test("cancel settles the order instead when the customer approved just before", async ({
    assert,
  }) => {
    vipps.cancel.rejects(new Error("already authorized"));
    vipps.info.resolves({ state: "AUTHORIZED" });
    const state = await StandCartCheckoutService.cancel(NEW_ORDER_ID);
    assert.equal(state.status, "paid");
    assert.isTrue(place.calledOnce);
  });
});
