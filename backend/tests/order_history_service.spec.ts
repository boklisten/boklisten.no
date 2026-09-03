import { test } from "@japa/runner";

import type { OrderHistorySources } from "#services/order_history_service";
import { presentOrderHistory } from "#services/order_history_service";
import type { Delivery } from "#shared/delivery/delivery";
import type { Order } from "#shared/order/order";
import type { OrderItem } from "#shared/order/order-item/order-item";
import type { Payment } from "#shared/payment/payment";

const IDA = "ida-id";
const PETRA = "petra-id";
const EMPLOYEE = "employee-id";
const BRANCH = "branch-id";
const OTHER_BRANCH = "other-branch-id";
const BLID = "12345678";

const T1 = new Date("2026-08-01T10:00:00.000Z");
const DEADLINE = new Date("2027-07-01T00:00:00.000Z");

type TestOrderItem = Omit<OrderItem, "handout" | "delivered"> &
  Partial<Pick<OrderItem, "handout" | "delivered">>;

function completeOrderItem(orderItem: TestOrderItem): OrderItem {
  return { handout: false, delivered: false, ...orderItem };
}

function makeOrder(
  overrides: Omit<Partial<Order>, "orderItems"> & { orderItems?: TestOrderItem[] } = {},
): Order {
  const { orderItems = [rentItem()], ...rest } = overrides;
  return {
    id: "order-1",
    amount: 0,
    branch: BRANCH,
    customer: IDA,
    byCustomer: false,
    employee: EMPLOYEE,
    placed: true,
    payments: [],
    handoutByDelivery: false,
    creationTime: T1,
    ...rest,
    orderItems: orderItems.map(completeOrderItem),
  };
}

function rentItem(overrides: Partial<TestOrderItem> = {}): TestOrderItem {
  return {
    type: "rent",
    item: "item-1",
    blid: BLID,
    title: "Sinus 1T",
    amount: 0,
    unitPrice: 0,
    info: { from: T1, to: DEADLINE, periodType: "year", numberOfPeriods: 1 },
    ...overrides,
  };
}

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment-1",
    method: "card",
    order: "order-1",
    amount: 100,
    customer: IDA,
    branch: BRANCH,
    confirmed: true,
    creationTime: T1,
    ...overrides,
  };
}

function baseSources(overrides: Partial<OrderHistorySources> = {}): OrderHistorySources {
  return {
    customerId: IDA,
    audience: "employee",
    orders: [makeOrder()],
    payments: new Map(),
    deliveries: new Map(),
    handovers: [],
    counterpartOrders: [],
    userNames: new Map([
      [IDA, "Ida"],
      [PETRA, "Petra"],
      [EMPLOYEE, "Emil Ansatt"],
    ]),
    branchNames: new Map([
      [BRANCH, "Ullern VGS"],
      [OTHER_BRANCH, "Nydalen VGS"],
    ]),
    ...overrides,
  };
}

test.group("OrderHistoryService.presentOrderHistory() – header", () => {
  test("presents branch, employee and timestamps from the order", ({ assert }) => {
    const [entry] = presentOrderHistory(baseSources());

    assert.equal(entry?.id, "order-1");
    assert.equal(entry?.creationTime, T1.toISOString());
    assert.deepEqual(entry?.branch, { id: BRANCH, name: "Ullern VGS" });
    assert.deepEqual(entry?.employee, { detailsId: EMPLOYEE, name: "Emil Ansatt" });
    assert.isFalse(entry?.byCustomer);
    assert.isFalse(entry?.emailSuppressed);
    assert.isNull(entry?.checkoutState);
  });

  test("hides the employee and staff bookkeeping for the customer audience", ({ assert }) => {
    const [entry] = presentOrderHistory(
      baseSources({
        audience: "customer",
        orders: [makeOrder({ notification: { email: false }, checkoutState: "PaymentSuccessful" })],
      }),
    );

    assert.isNull(entry?.employee);
    assert.isFalse(entry?.emailSuppressed);
    assert.isNull(entry?.checkoutState);
  });

  test("flags suppressed e-mail and carries the checkout state", ({ assert }) => {
    const [entry] = presentOrderHistory(
      baseSources({
        orders: [makeOrder({ notification: { email: false }, checkoutState: "PaymentSuccessful" })],
      }),
    );

    assert.isTrue(entry?.emailSuppressed);
    assert.equal(entry?.checkoutState, "PaymentSuccessful");
  });

  test("sorts orders newest first", ({ assert }) => {
    const older = makeOrder({ id: "older", creationTime: new Date("2026-07-01T10:00:00.000Z") });
    const newer = makeOrder({ id: "newer", creationTime: new Date("2026-08-05T10:00:00.000Z") });

    const entries = presentOrderHistory(baseSources({ orders: [older, newer] }));

    assert.deepEqual(
      entries.map((entry) => entry.id),
      ["newer", "older"],
    );
  });
});

test.group("OrderHistoryService.presentOrderHistory() – payment status", () => {
  test("is free when the amount is zero", ({ assert }) => {
    const [entry] = presentOrderHistory(baseSources());

    assert.equal(entry?.paymentStatus, "free");
  });

  test("is paid when payments cover the amount, counting unconfirmed legacy dibs", ({ assert }) => {
    const order = makeOrder({ amount: 100, payments: ["payment-1"] });
    const payment = makePayment({ method: "dibs", confirmed: false, amount: 100 });

    const [entry] = presentOrderHistory(
      baseSources({ orders: [order], payments: new Map([[payment.id, payment]]) }),
    );

    assert.equal(entry?.paymentStatus, "paid");
    assert.deepEqual(entry?.payments, [
      {
        id: "payment-1",
        method: "dibs",
        methodLabel: "kort (nettbetaling)",
        amount: 100,
        confirmed: false,
        branchName: "Ullern VGS",
        time: T1.toISOString(),
      },
    ]);
  });

  test("is unpaid when the amount is positive and no payment covers it", ({ assert }) => {
    const order = makeOrder({ amount: 100 });

    const [entry] = presentOrderHistory(baseSources({ orders: [order] }));

    assert.equal(entry?.paymentStatus, "unpaid");
  });

  test("is refunded when the amount is negative", ({ assert }) => {
    const order = makeOrder({
      amount: -270,
      orderItems: [rentItem({ type: "cancel", amount: -270, unitPrice: -270, info: undefined })],
    });

    const [entry] = presentOrderHistory(baseSources({ orders: [order] }));

    assert.equal(entry?.paymentStatus, "refunded");
  });

  test("is invoice when the order settles an invoice", ({ assert }) => {
    const order = makeOrder({
      amount: 1080,
      orderItems: [
        rentItem({ type: "invoice-paid", amount: 1080, unitPrice: 1080, info: undefined }),
      ],
    });

    const [entry] = presentOrderHistory(baseSources({ orders: [order] }));

    assert.equal(entry?.paymentStatus, "invoice");
  });

  test("skips payment ids whose document is gone", ({ assert }) => {
    const order = makeOrder({ amount: 100, payments: ["missing-payment"] });

    const [entry] = presentOrderHistory(baseSources({ orders: [order] }));

    assert.deepEqual(entry?.payments, []);
    assert.equal(entry?.paymentStatus, "unpaid");
  });
});

test.group("OrderHistoryService.presentOrderHistory() – items", () => {
  test("presents a rent item with its period and blid", ({ assert }) => {
    const [entry] = presentOrderHistory(baseSources());

    assert.deepEqual(entry?.items, [
      {
        type: "rent",
        typeLabel: "lån",
        itemId: "item-1",
        title: "Sinus 1T",
        blid: BLID,
        amount: 0,
        unitPrice: 0,
        period: { from: T1.toISOString(), to: DEADLINE.toISOString(), periodType: "year" },
        amountLeftToPay: null,
        buybackAmount: null,
        customerItemId: null,
        handout: false,
        delivered: false,
        movedToOrderId: null,
        movedFromOrderId: null,
        transfer: null,
      },
    ]);
  });

  test("carries partly-payment amounts, customer item and move links", ({ assert }) => {
    const order = makeOrder({
      orderItems: [
        rentItem({
          type: "partly-payment",
          blid: undefined,
          customerItem: "customer-item-1",
          movedToOrder: "order-2",
          movedFromOrder: "order-0",
          handout: true,
          delivered: true,
          info: { from: T1, to: DEADLINE, periodType: "semester", amountLeftToPay: 350 },
        }),
      ],
    });

    const [entry] = presentOrderHistory(baseSources({ orders: [order] }));
    const [item] = entry?.items ?? [];

    assert.equal(item?.typeLabel, "delbetaling");
    assert.isNull(item?.blid);
    assert.equal(item?.customerItemId, "customer-item-1");
    assert.equal(item?.movedToOrderId, "order-2");
    assert.equal(item?.movedFromOrderId, "order-0");
    assert.equal(item?.amountLeftToPay, 350);
    assert.isTrue(item?.handout);
    assert.isTrue(item?.delivered);
    assert.equal(item?.period?.periodType, "semester");
  });

  test("carries the buyback amount and no period on a buyback item", ({ assert }) => {
    const order = makeOrder({
      orderItems: [
        rentItem({
          type: "buyback",
          info: { buybackAmount: 120, customerItem: "customer-item-1" },
        }),
      ],
    });

    const [entry] = presentOrderHistory(baseSources({ orders: [order] }));
    const [item] = entry?.items ?? [];

    assert.equal(item?.buybackAmount, 120);
    assert.isNull(item?.period);
    // The info block names the customer item even when the item-level field is missing.
    assert.equal(item?.customerItemId, "customer-item-1");
  });
});

test.group("OrderHistoryService.presentOrderHistory() – match transfers", () => {
  const receiveOrder = () =>
    makeOrder({
      id: "receive-order",
      byCustomer: true,
      employee: undefined,
      orderItems: [rentItem({ type: "match-receive", movedFromOrder: "order-0" })],
    });
  const deliverOrder = () =>
    makeOrder({
      id: "deliver-order",
      byCustomer: true,
      employee: undefined,
      orderItems: [rentItem({ type: "match-deliver", info: undefined })],
    });

  test("names the sender of a received book from the handover row on the order", ({ assert }) => {
    const occurredAt = new Date("2026-08-01T09:59:58.000Z");

    const [entry] = presentOrderHistory(
      baseSources({
        orders: [receiveOrder()],
        handovers: [
          {
            blid: BLID,
            fromUserDetailId: PETRA,
            toUserDetailId: IDA,
            occurredAt,
            orderId: "receive-order",
          },
        ],
      }),
    );

    assert.deepEqual(entry?.items[0]?.transfer, {
      direction: "received",
      counterparty: { detailsId: PETRA, name: "Petra" },
      time: occurredAt.toISOString(),
    });
  });

  test("names the receiver of a delivered book from the handover row the sender scanned", ({
    assert,
  }) => {
    const occurredAt = new Date("2026-08-01T10:00:30.000Z");

    const [entry] = presentOrderHistory(
      baseSources({
        orders: [deliverOrder()],
        handovers: [
          {
            blid: BLID,
            fromUserDetailId: IDA,
            toUserDetailId: PETRA,
            occurredAt,
            // The handover row points at the receiver's order, never the sender's.
            orderId: "petras-receive-order",
          },
        ],
      }),
    );

    assert.deepEqual(entry?.items[0]?.transfer, {
      direction: "delivered",
      counterparty: { detailsId: PETRA, name: "Petra" },
      time: occurredAt.toISOString(),
    });
  });

  test("pairs a legacy received book with the counterpart's deliver order in the same moment", ({
    assert,
  }) => {
    const counterpart = makeOrder({
      id: "petras-deliver-order",
      customer: PETRA,
      creationTime: new Date("2026-08-01T09:59:59.500Z"),
      orderItems: [rentItem({ type: "match-deliver", info: undefined })],
    });

    const [entry] = presentOrderHistory(
      baseSources({ orders: [receiveOrder()], counterpartOrders: [counterpart] }),
    );

    assert.deepEqual(entry?.items[0]?.transfer, {
      direction: "received",
      counterparty: { detailsId: PETRA, name: "Petra" },
      time: T1.toISOString(),
    });
  });

  test("leaves the counterparty unknown when the counterpart order is outside the pairing window", ({
    assert,
  }) => {
    const counterpart = makeOrder({
      id: "petras-deliver-order",
      customer: PETRA,
      creationTime: new Date("2026-08-01T12:00:00.000Z"),
      orderItems: [rentItem({ type: "match-deliver", info: undefined })],
    });

    const [entry] = presentOrderHistory(
      baseSources({ orders: [receiveOrder()], counterpartOrders: [counterpart] }),
    );

    assert.deepEqual(entry?.items[0]?.transfer, {
      direction: "received",
      counterparty: null,
      time: T1.toISOString(),
    });
  });

  test("does not pair a delivery with the sender's own handover of another copy", ({ assert }) => {
    const [entry] = presentOrderHistory(
      baseSources({
        orders: [deliverOrder()],
        handovers: [
          {
            blid: "87654321",
            fromUserDetailId: IDA,
            toUserDetailId: PETRA,
            occurredAt: T1,
            orderId: "petras-receive-order",
          },
        ],
      }),
    );

    assert.isNull(entry?.items[0]?.transfer?.counterparty);
  });
});

test.group("OrderHistoryService.presentOrderHistory() – delivery", () => {
  test("presents a Bring delivery with tracking, address and package type", ({ assert }) => {
    const estimated = new Date("2026-08-05T00:00:00.000Z");
    const delivery: Delivery = {
      id: "delivery-1",
      method: "bring",
      order: "order-1",
      amount: 79,
      info: {
        from: "0139",
        to: "0370",
        facilityAddress: { address: "Lager 1", postalCode: "0139", postalCity: "Oslo" },
        shipmentAddress: { name: "Ida", address: "Gata 1", postalCode: "0370", postalCity: "Oslo" },
        estimatedDelivery: estimated,
        trackingNumber: "TRACK123",
        product: "3584",
      },
    };
    const order = makeOrder({ handoutByDelivery: true, delivery: "delivery-1" });

    const [entry] = presentOrderHistory(
      baseSources({ orders: [order], deliveries: new Map([["delivery-1", delivery]]) }),
    );

    assert.deepEqual(entry?.delivery, {
      method: "bring",
      trackingNumber: "TRACK123",
      estimatedDelivery: estimated.toISOString(),
      shipmentAddress: { name: "Ida", address: "Gata 1", postalCode: "0370", postalCity: "Oslo" },
      productLabel: "pakke i postkassen",
      amount: 79,
    });
  });

  test("presents a branch pickup delivery by branch name", ({ assert }) => {
    const delivery: Delivery = {
      id: "delivery-1",
      method: "branch",
      order: "order-1",
      amount: 0,
      info: { branch: OTHER_BRANCH },
    };
    const order = makeOrder({ delivery: "delivery-1" });

    const [entry] = presentOrderHistory(
      baseSources({ orders: [order], deliveries: new Map([["delivery-1", delivery]]) }),
    );

    assert.deepEqual(entry?.delivery, { method: "branch", branchName: "Nydalen VGS" });
  });

  test("marks a mail order whose delivery document is gone", ({ assert }) => {
    const order = makeOrder({ handoutByDelivery: true, delivery: "gone" });

    const [entry] = presentOrderHistory(baseSources({ orders: [order] }));

    assert.deepEqual(entry?.delivery, { method: "missing" });
  });

  test("has no delivery for a plain stand order", ({ assert }) => {
    const [entry] = presentOrderHistory(baseSources());

    assert.isNull(entry?.delivery);
  });
});
