import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import type { StandCartLineContext } from "#services/stand_cart/stand_cart_line_resolver";
import type { CheckoutLine } from "#services/stand_cart/stand_cart_order_builder";
import { allocateRefund, StandCartRefund } from "#services/stand_cart/stand_cart_refund";
import { StorageService } from "#services/storage_service";
import { VippsPaymentService } from "#services/vipps/vipps_payment_service";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Item } from "#shared/item";
import type { Order } from "#shared/order/order";
import type { OrderItem } from "#shared/order/order-item/order-item";
import type { Payment } from "#shared/payment/payment";
import type { StandCartOption, StandCartRefundPlan } from "#shared/stand_cart";
import { mock } from "#tests/test-doubles";

const NOW = new Date("2026-09-09T10:00:00.000Z");
const PAID_AT = new Date("2026-08-01T10:00:00.000Z");
const LONG_AGO = new Date("2025-08-01T10:00:00.000Z");
const PAID_ORDER_ID = "5f7f7f7f7f7f7f7f7f7f7f31";
const OTHER_ORDER_ID = "5f7f7f7f7f7f7f7f7f7f7f32";
const HANDOUT_ORDER_ID = "5f7f7f7f7f7f7f7f7f7f7f33";

const item = mock<Item>({ id: "item1", title: "Sinus 1T", price: 500 });
const otherItem = mock<Item>({ id: "item2", title: "Kosmos SF", price: 400 });

function orderItemFor(book: Item, amount: number): OrderItem {
  return mock<OrderItem>({ type: "rent", item: book.id, title: book.title, amount });
}

function paidOrder(
  id: string,
  payments: string[],
  orderItems: OrderItem[] = [orderItemFor(item, 250)],
): Order {
  return mock<Order>({ id, payments, orderItems });
}

function payment(id: string, method: Payment["method"], amount: number, creationTime = PAID_AT) {
  return mock<Payment>({ id, method, amount, creationTime });
}

function option(type: StandCartOption["type"], price: number): StandCartOption {
  return { type, price, available: true, monitored: false };
}

function checkoutLine(context: StandCartLineContext, chosen: StandCartOption): CheckoutLine {
  const book = context.item;
  return {
    line: {
      key: `${context.kind}:${book.id}`,
      source: { kind: "item", itemId: book.id, blid: "1" },
      itemId: book.id,
      title: book.title,
      blid: null,
      options: [chosen],
      defaultOptionIndex: 0,
      unavailableReason: null,
      originalBranch: null,
      notes: [],
    },
    context,
    option: chosen,
  };
}

function orderLine(order: Order, book = item, price = -250): CheckoutLine {
  const orderItem = order.orderItems.find((candidate) => candidate.item === book.id);
  if (!orderItem) {
    throw new Error("no such order item");
  }
  return checkoutLine({ kind: "order", order, orderItem, item: book }, option("cancel", price));
}

function customerItemLine(customerItem: CustomerItem, price = -250): CheckoutLine {
  return checkoutLine(
    { kind: "customerItem", customerItem, item, handoutBranch: null },
    option("cancel", price),
  );
}

/** Vipps's answer for a payment of `captured` kr, of which `refunded` kr are already refunded. */
function vippsInfo(captured: number, refunded = 0) {
  return {
    state: "AUTHORIZED",
    aggregate: {
      capturedAmount: { currency: "NOK", value: captured * 100 },
      refundedAmount: { currency: "NOK", value: refunded * 100 },
    },
  };
}

/** The refunds of a plan that must be automatic, as order and amount pairs. */
function vippsRefunds(plan: StandCartRefundPlan | null) {
  if (plan?.kind !== "vipps") {
    throw new Error(`expected a Vipps plan, got ${JSON.stringify(plan)}`);
  }
  return plan.refunds.map(({ orderId, amount }) => ({ orderId, amount }));
}

const transaction = (orderId: string, refundable: number) => ({
  orderId,
  method: "vipps-epayment" as const,
  refundable,
});

test.group("allocateRefund", () => {
  test("one transaction that covers the total is refunded for the total", ({ assert }) => {
    const refunds = allocateRefund(250, [transaction(PAID_ORDER_ID, 500)]);
    assert.deepEqual(
      refunds?.map(({ orderId, amount }) => ({ orderId, amount })),
      [{ orderId: PAID_ORDER_ID, amount: 250 }],
    );
  });

  test("fills the transactions in order, each up to what Vipps still allows", ({ assert }) => {
    const refunds = allocateRefund(600, [
      transaction(PAID_ORDER_ID, 250),
      transaction(OTHER_ORDER_ID, 400),
    ]);
    assert.deepEqual(
      refunds?.map(({ orderId, amount }) => ({ orderId, amount })),
      [
        { orderId: PAID_ORDER_ID, amount: 250 },
        { orderId: OTHER_ORDER_ID, amount: 350 },
      ],
    );
  });

  test("leaves out a transaction with nothing left to refund", ({ assert }) => {
    const refunds = allocateRefund(100, [
      transaction(PAID_ORDER_ID, 0),
      transaction(OTHER_ORDER_ID, 400),
    ]);
    assert.deepEqual(
      refunds?.map(({ orderId, amount }) => ({ orderId, amount })),
      [{ orderId: OTHER_ORDER_ID, amount: 100 }],
    );
  });

  test("gives up when the transactions cannot cover the total", ({ assert }) => {
    assert.isNull(allocateRefund(700, [transaction(PAID_ORDER_ID, 250)]));
  });
});

test.group("StandCartRefund.plan", (group) => {
  let sandbox: sinon.SinonSandbox;
  let ordersGet: sinon.SinonStub;
  let paymentsGetMany: sinon.SinonStub;
  let info: sinon.SinonStub;

  group.each.setup(() => {
    sandbox = createSandbox();
    ordersGet = sandbox.stub(StorageService.Orders, "getOrNull").resolves(null);
    paymentsGetMany = sandbox.stub(StorageService.Payments, "getMany").resolves([]);
    info = sandbox.stub().resolves(vippsInfo(250));
    sandbox.stub(VippsPaymentService, "payment").value({ info });
  });
  group.each.teardown(() => sandbox.restore());

  test("a cancelled order paid by a Vipps request is refunded on that request", async ({
    assert,
  }) => {
    paymentsGetMany.resolves([payment("p1", "vipps-epayment", 250)]);
    const plan = await StandCartRefund.plan([orderLine(paidOrder(PAID_ORDER_ID, ["p1"]))], NOW);
    assert.deepEqual(plan, {
      kind: "vipps",
      refunds: [{ orderId: PAID_ORDER_ID, method: "vipps-epayment", amount: 250 }],
    });
    assert.deepEqual(info.firstCall.args, [PAID_ORDER_ID]);
  });

  test("an online Vipps Checkout payment qualifies as well", async ({ assert }) => {
    paymentsGetMany.resolves([payment("p1", "vipps-checkout", 250)]);
    const plan = await StandCartRefund.plan([orderLine(paidOrder(PAID_ORDER_ID, ["p1"]))], NOW);
    assert.deepEqual(vippsRefunds(plan), [{ orderId: PAID_ORDER_ID, amount: 250 }]);
  });

  test("a held book follows the handout order back to the order that was paid", async ({
    assert,
  }) => {
    const customerItem = mock<CustomerItem>({
      id: "ci1",
      item: item.id,
      orders: [HANDOUT_ORDER_ID],
    });
    const handoutOrder = mock<Order>({
      id: HANDOUT_ORDER_ID,
      payments: [],
      orderItems: [
        { ...orderItemFor(item, 0), customerItem: "ci1", movedFromOrder: PAID_ORDER_ID },
      ],
    });
    ordersGet.withArgs(HANDOUT_ORDER_ID).resolves(handoutOrder);
    ordersGet.withArgs(PAID_ORDER_ID).resolves(paidOrder(PAID_ORDER_ID, ["p1"]));
    paymentsGetMany.resolves([payment("p1", "vipps-checkout", 250)]);

    const plan = await StandCartRefund.plan([customerItemLine(customerItem)], NOW);

    assert.deepEqual(vippsRefunds(plan), [{ orderId: PAID_ORDER_ID, amount: 250 }]);
    assert.deepEqual(info.firstCall.args, [PAID_ORDER_ID]);
  });

  test("a held book whose handout order was itself paid is refunded on that order", async ({
    assert,
  }) => {
    const customerItem = mock<CustomerItem>({
      id: "ci1",
      item: item.id,
      orders: [HANDOUT_ORDER_ID],
    });
    ordersGet.withArgs(HANDOUT_ORDER_ID).resolves(
      mock<Order>({
        id: HANDOUT_ORDER_ID,
        payments: ["p1"],
        orderItems: [{ ...orderItemFor(item, 250), customerItem: "ci1" }],
      }),
    );
    paymentsGetMany.resolves([payment("p1", "vipps-epayment", 250)]);

    const plan = await StandCartRefund.plan([customerItemLine(customerItem)], NOW);

    assert.deepEqual(vippsRefunds(plan), [{ orderId: HANDOUT_ORDER_ID, amount: 250 }]);
    assert.deepEqual(info.firstCall.args, [HANDOUT_ORDER_ID]);
  });

  test("the net total is refunded when a purchase is in the same cart", async ({ assert }) => {
    paymentsGetMany.resolves([payment("p1", "vipps-epayment", 250)]);
    const purchase = checkoutLine({ kind: "item", item: otherItem }, option("buy", 100));
    const plan = await StandCartRefund.plan(
      [orderLine(paidOrder(PAID_ORDER_ID, ["p1"])), purchase],
      NOW,
    );
    assert.deepEqual(vippsRefunds(plan), [{ orderId: PAID_ORDER_ID, amount: 150 }]);
  });

  test("two cancelled orders are refunded on each their own request", async ({ assert }) => {
    paymentsGetMany
      .withArgs(["p1"])
      .resolves([payment("p1", "vipps-epayment", 250)])
      .withArgs(["p2"])
      .resolves([payment("p2", "vipps-checkout", 400)]);
    info.withArgs(OTHER_ORDER_ID).resolves(vippsInfo(400));
    const plan = await StandCartRefund.plan(
      [
        orderLine(paidOrder(PAID_ORDER_ID, ["p1"])),
        orderLine(
          paidOrder(OTHER_ORDER_ID, ["p2"], [orderItemFor(otherItem, 400)]),
          otherItem,
          -400,
        ),
      ],
      NOW,
    );
    assert.deepEqual(vippsRefunds(plan), [
      { orderId: PAID_ORDER_ID, amount: 250 },
      { orderId: OTHER_ORDER_ID, amount: 400 },
    ]);
  });

  test("a cash-paid order sends the whole refund to the manual route, naming the book", async ({
    assert,
  }) => {
    paymentsGetMany
      .withArgs(["p1"])
      .resolves([payment("p1", "vipps-epayment", 250)])
      .withArgs(["p2"])
      .resolves([payment("p2", "cash", 400)]);
    const plan = await StandCartRefund.plan(
      [
        orderLine(paidOrder(PAID_ORDER_ID, ["p1"])),
        orderLine(
          paidOrder(OTHER_ORDER_ID, ["p2"], [orderItemFor(otherItem, 400)]),
          otherItem,
          -400,
        ),
      ],
      NOW,
    );
    assert.deepEqual(plan, { kind: "manual", reasons: ["«Kosmos SF» ble betalt kontant"] });
  });

  test("card and manual Vipps payments have no transaction to refund against", async ({
    assert,
  }) => {
    paymentsGetMany
      .withArgs(["p1"])
      .resolves([payment("p1", "card", 250)])
      .withArgs(["p2"])
      .resolves([payment("p2", "vipps", 400)]);
    const plan = await StandCartRefund.plan(
      [
        orderLine(paidOrder(PAID_ORDER_ID, ["p1"])),
        orderLine(
          paidOrder(OTHER_ORDER_ID, ["p2"], [orderItemFor(otherItem, 400)]),
          otherItem,
          -400,
        ),
      ],
      NOW,
    );
    assert.deepEqual(plan, {
      kind: "manual",
      reasons: ["«Sinus 1T» ble betalt med kort", "«Kosmos SF» ble betalt manuelt med Vipps"],
    });
  });

  test("a book the customer sells has no payment to refund", async ({ assert }) => {
    const sale = checkoutLine({ kind: "item", item }, option("sell", -200));
    const plan = await StandCartRefund.plan([sale], NOW);
    assert.deepEqual(plan, {
      kind: "manual",
      reasons: ["«Sinus 1T» er et innkjøp, ikke en refusjon av en betaling"],
    });
  });

  test("a payment older than a year is outside Vipps's refund window", async ({ assert }) => {
    paymentsGetMany.resolves([payment("p1", "vipps-epayment", 250, LONG_AGO)]);
    const plan = await StandCartRefund.plan([orderLine(paidOrder(PAID_ORDER_ID, ["p1"]))], NOW);
    assert.deepEqual(plan, {
      kind: "manual",
      reasons: ["«Sinus 1T» ble betalt for over ett år siden"],
    });
    assert.isFalse(info.called);
  });

  test("a transaction Vipps has already refunded in full cannot cover the amount", async ({
    assert,
  }) => {
    paymentsGetMany.resolves([payment("p1", "vipps-epayment", 250)]);
    info.resolves(vippsInfo(250, 250));
    const plan = await StandCartRefund.plan([orderLine(paidOrder(PAID_ORDER_ID, ["p1"]))], NOW);
    assert.deepEqual(plan, {
      kind: "manual",
      reasons: ["Beløpet er større enn det Vipps kan refundere på betalingene"],
    });
  });

  test("goes manual when Vipps does not answer", async ({ assert }) => {
    paymentsGetMany.resolves([payment("p1", "vipps-epayment", 250)]);
    info.rejects(new Error("boom"));
    const plan = await StandCartRefund.plan([orderLine(paidOrder(PAID_ORDER_ID, ["p1"]))], NOW);
    assert.deepEqual(plan, {
      kind: "manual",
      reasons: ["Vipps svarte ikke på spørsmål om betalingen for «Sinus 1T»"],
    });
  });

  test("a payment Vipps has no record of cannot be refunded there", async ({ assert }) => {
    paymentsGetMany.resolves([payment("p1", "vipps-checkout", 250)]);
    info.rejects(
      new Error(
        '{"extraDetails":[{"name":"ErrorCode","reason":"5090"}],"title":"Reference not found","status":404}',
      ),
    );
    const plan = await StandCartRefund.plan([orderLine(paidOrder(PAID_ORDER_ID, ["p1"]))], NOW);
    assert.deepEqual(plan, {
      kind: "manual",
      reasons: ["Fant ingen Vipps-betaling for «Sinus 1T»"],
    });
  });

  test("a cart with nothing to refund has no plan", async ({ assert }) => {
    const purchase = checkoutLine({ kind: "item", item: otherItem }, option("buy", 100));
    assert.isNull(await StandCartRefund.plan([purchase], NOW));
  });
});
