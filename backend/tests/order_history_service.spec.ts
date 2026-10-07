import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import Order from "#models/order";
import { EmployeeMonitoringService } from "#services/employee_monitoring_service";
import type { OrderHistorySources } from "#services/order_history_service";
import { OrderHistoryService, presentOrderHistory } from "#services/order_history_service";
import type { Order as OrderDto, OrderItem as OrderItemDto } from "#shared/order/order";
import type { Payment } from "#shared/payment/payment";
import { createBranch } from "#tests/branch_fixtures";
import { deliveryDto } from "#tests/delivery_fixtures";
import { fixtureId } from "#tests/fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createPayment, paymentDto } from "#tests/payment_fixtures";
import { createUser } from "#tests/user_fixtures";

const IDA = "ida-id";
const PETRA = "petra-id";
const EMPLOYEE = "employee-id";
const BRANCH = "branch-id";
const OTHER_BRANCH = "other-branch-id";
const BLID = "12345678";

const T1 = new Date("2026-08-01T10:00:00.000Z");
const DEADLINE = "2027-07-01";

type TestOrderItem = Partial<OrderItemDto>;

function makeOrder(
  overrides: Omit<Partial<OrderDto>, "orderItems"> & { orderItems?: TestOrderItem[] } = {},
): OrderDto {
  const { orderItems = [rentItem()], ...rest } = overrides;
  return {
    id: "order-1",
    amount: 0,
    branchId: BRANCH,
    customerId: IDA,
    byCustomer: false,
    employeeId: EMPLOYEE,
    placed: true,
    notifyByEmail: true,
    checkoutState: null,
    createdAt: T1,
    updatedAt: T1,
    ...rest,
    orderItems: orderItems.map((orderItem, index) => rentItem({ id: index + 1, ...orderItem })),
  };
}

function rentItem(overrides: TestOrderItem = {}): OrderItemDto {
  return {
    id: 1,
    type: "rent",
    itemId: "item-1",
    blid: BLID,
    title: "Sinus 1T",
    isbn: null,
    amount: 0,
    unitPrice: 0,
    handout: false,
    delivered: false,
    customerItemId: null,
    periodFrom: T1,
    periodTo: DEADLINE,
    numberOfPeriods: 1,
    periodType: "year",
    amountLeftToPay: null,
    buybackAmount: null,
    movedFromOrderId: null,
    movedToOrderId: null,
    ...overrides,
  };
}

/** A line without a period, as cancel, buyback and match-deliver lines are stored. */
const NO_PERIOD = { periodFrom: null, periodTo: null, numberOfPeriods: null, periodType: null };

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return paymentDto({ id: "payment-1", orderId: "order-1", createdAt: T1, ...overrides });
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
    assert.deepEqual(entry?.employee, { userId: EMPLOYEE, name: "Emil Ansatt" });
    assert.isFalse(entry?.byCustomer);
    assert.isFalse(entry?.emailSuppressed);
    assert.isNull(entry?.checkoutState);
  });

  test("hides the employee and staff bookkeeping for the customer audience", ({ assert }) => {
    const [entry] = presentOrderHistory(
      baseSources({
        audience: "customer",
        orders: [makeOrder({ notifyByEmail: false, checkoutState: "PaymentSuccessful" })],
      }),
    );

    assert.isNull(entry?.employee);
    assert.isFalse(entry?.emailSuppressed);
    assert.isNull(entry?.checkoutState);
  });

  test("flags suppressed e-mail and carries the checkout state", ({ assert }) => {
    const [entry] = presentOrderHistory(
      baseSources({
        orders: [makeOrder({ notifyByEmail: false, checkoutState: "PaymentSuccessful" })],
      }),
    );

    assert.isTrue(entry?.emailSuppressed);
    assert.equal(entry?.checkoutState, "PaymentSuccessful");
  });

  test("sorts orders newest first", ({ assert }) => {
    const older = makeOrder({ id: "older", createdAt: new Date("2026-07-01T10:00:00.000Z") });
    const newer = makeOrder({ id: "newer", createdAt: new Date("2026-08-05T10:00:00.000Z") });

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
    const order = makeOrder({ amount: 100 });
    const payment = makePayment({ method: "dibs", confirmed: false, amount: 100 });

    const [entry] = presentOrderHistory(
      baseSources({ orders: [order], payments: new Map([[order.id, [payment]]]) }),
    );

    assert.equal(entry?.paymentStatus, "paid");
    assert.deepEqual(entry?.payments, [
      {
        id: "payment-1",
        method: "dibs",
        methodLabel: "kort (nettbetaling)",
        amount: 100,
        confirmed: false,
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
      orderItems: [rentItem({ type: "cancel", amount: -270, unitPrice: -270, ...NO_PERIOD })],
    });

    const [entry] = presentOrderHistory(baseSources({ orders: [order] }));

    assert.equal(entry?.paymentStatus, "refunded");
  });

  test("is invoice when the order settles an invoice", ({ assert }) => {
    const order = makeOrder({
      amount: 1080,
      orderItems: [rentItem({ type: "invoice-paid", amount: 1080, unitPrice: 1080, ...NO_PERIOD })],
    });

    const [entry] = presentOrderHistory(baseSources({ orders: [order] }));

    assert.equal(entry?.paymentStatus, "invoice");
  });

  test("is unpaid when the recorded payments fall short", ({ assert }) => {
    const order = makeOrder({ amount: 100 });

    const [entry] = presentOrderHistory(
      baseSources({
        orders: [order],
        payments: new Map([[order.id, [makePayment({ amount: 40 })]]]),
      }),
    );

    assert.lengthOf(entry?.payments ?? [], 1);
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
        isbn: null,
        blid: BLID,
        amount: 0,
        unitPrice: 0,
        period: { from: T1.toISOString(), to: DEADLINE, periodType: "year" },
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
          blid: null,
          customerItemId: "customer-item-1",
          movedToOrderId: "order-2",
          movedFromOrderId: "order-0",
          handout: true,
          delivered: true,
          periodType: "semester",
          numberOfPeriods: null,
          amountLeftToPay: 350,
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
          ...NO_PERIOD,
          buybackAmount: 120,
          customerItemId: "customer-item-1",
        }),
      ],
    });

    const [entry] = presentOrderHistory(baseSources({ orders: [order] }));
    const [item] = entry?.items ?? [];

    assert.equal(item?.buybackAmount, 120);
    assert.isNull(item?.period);
    assert.equal(item?.customerItemId, "customer-item-1");
  });
});

const receiveOrder = () =>
  makeOrder({
    id: "receive-order",
    byCustomer: true,
    employeeId: null,
    orderItems: [rentItem({ type: "match-receive", movedFromOrderId: "order-0" })],
  });

const deliverOrder = () =>
  makeOrder({
    id: "deliver-order",
    byCustomer: true,
    employeeId: null,
    orderItems: [rentItem({ type: "match-deliver", ...NO_PERIOD })],
  });

test.group("OrderHistoryService.presentOrderHistory() – match transfers", () => {
  test("names the sender of a received book from the handover row on the order", ({ assert }) => {
    const occurredAt = new Date("2026-08-01T09:59:58.000Z");

    const [entry] = presentOrderHistory(
      baseSources({
        orders: [receiveOrder()],
        handovers: [
          {
            blid: BLID,
            fromUserId: PETRA,
            toUserId: IDA,
            occurredAt,
            orderId: "receive-order",
          },
        ],
      }),
    );

    assert.deepEqual(entry?.items[0]?.transfer, {
      direction: "received",
      counterparty: { userId: PETRA, name: "Petra" },
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
            fromUserId: IDA,
            toUserId: PETRA,
            occurredAt,
            // The handover row points at the receiver's order, never the sender's.
            orderId: "petras-receive-order",
          },
        ],
      }),
    );

    assert.deepEqual(entry?.items[0]?.transfer, {
      direction: "delivered",
      counterparty: { userId: PETRA, name: "Petra" },
      time: occurredAt.toISOString(),
    });
  });

  test("pairs a legacy received book with the counterpart's deliver order in the same moment", ({
    assert,
  }) => {
    const counterpart = makeOrder({
      id: "petras-deliver-order",
      customerId: PETRA,
      createdAt: new Date("2026-08-01T09:59:59.500Z"),
      orderItems: [rentItem({ type: "match-deliver", ...NO_PERIOD })],
    });

    const [entry] = presentOrderHistory(
      baseSources({ orders: [receiveOrder()], counterpartOrders: [counterpart] }),
    );

    assert.deepEqual(entry?.items[0]?.transfer, {
      direction: "received",
      counterparty: { userId: PETRA, name: "Petra" },
      time: T1.toISOString(),
    });
  });

  test("leaves the counterparty unknown when the counterpart order is outside the pairing window", ({
    assert,
  }) => {
    const counterpart = makeOrder({
      id: "petras-deliver-order",
      customerId: PETRA,
      createdAt: new Date("2026-08-01T12:00:00.000Z"),
      orderItems: [rentItem({ type: "match-deliver", ...NO_PERIOD })],
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
            fromUserId: IDA,
            toUserId: PETRA,
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
    const delivery = deliveryDto({
      orderId: "order-1",
      amount: 79,
      shipmentName: "Ida",
      shipmentAddress: "Gata 1",
      shipmentPostalCode: "0370",
      shipmentPostalCity: "Oslo",
      estimatedDelivery: estimated,
      trackingNumber: "TRACK123",
      product: "3584",
    });
    const order = makeOrder();

    const [entry] = presentOrderHistory(
      baseSources({ orders: [order], deliveries: new Map([["order-1", delivery]]) }),
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
    const delivery = deliveryDto({ orderId: "order-1", method: "branch", branchId: OTHER_BRANCH });
    const order = makeOrder();

    const [entry] = presentOrderHistory(
      baseSources({ orders: [order], deliveries: new Map([["order-1", delivery]]) }),
    );

    assert.deepEqual(entry?.delivery, { method: "branch", branchName: "Nydalen VGS" });
  });

  test("has no delivery for a plain stand order", ({ assert }) => {
    const [entry] = presentOrderHistory(baseSources());

    assert.isNull(entry?.delivery);
  });
});

/** An employee, a customer, a branch and two books in the test Postgres, for the write paths. */
async function seedOrderWorld() {
  const [branch, customer, sinus, matte] = await Promise.all([
    createBranch({ name: "Ullern VGS" }),
    createUser({ name: "Ida" }),
    createItem({ title: "Sinus 1T" }),
    createItem({ title: "Sinus 1P" }),
  ]);
  return { branch, customer, sinus, matte };
}

test.group("OrderHistoryService.deleteOrder()", (group) => {
  let sandbox: sinon.SinonSandbox;
  let report: sinon.SinonStub;
  const employee = { userId: EMPLOYEE, permission: "employee" as const };

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
    report = sandbox.stub(EmployeeMonitoringService, "report").resolves();
  });
  group.each.teardown(() => sandbox.restore());

  test("deletes the order with its lines and reports what the order held", async ({ assert }) => {
    const { branch, customer, sinus, matte } = await seedOrderWorld();
    const order = await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      amount: 250,
      orderItems: [{ itemId: sinus.id }, { itemId: matte.id, blid: "87654321" }],
    });

    await OrderHistoryService.deleteOrder(order.id, employee);

    assert.isNull(await Order.find(order.id));
    assert.isTrue(report.calledOnce);
    assert.deepEqual(report.firstCall.args[0], {
      action: "order-deleted",
      employee,
      customerId: customer.id,
      details: [
        { label: "Ordre-ID", value: order.id },
        { label: "Filial", value: "Ullern VGS" },
        { label: "Beløp", value: "250 kr" },
        { label: "Bøker", value: "«Sinus 1T», «Sinus 1P»" },
      ],
    });
  });

  test("refuses when the order does not exist, and reports nothing", async ({ assert }) => {
    await assert.rejects(() => OrderHistoryService.deleteOrder(fixtureId("dead"), employee));

    assert.isFalse(report.called);
  });
});

test.group("OrderHistoryService.updateBranch()", (group) => {
  let sandbox: sinon.SinonSandbox;
  let report: sinon.SinonStub;
  const employee = { userId: EMPLOYEE, permission: "employee" as const };

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
    report = sandbox.stub(EmployeeMonitoringService, "report").resolves();
  });
  group.each.teardown(() => sandbox.restore());

  test("moves the order and reports the change with both branch names", async ({ assert }) => {
    const { branch, customer, sinus } = await seedOrderWorld();
    const newBranch = await createBranch({ name: "Persbråten VGS" });
    const order = await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      orderItems: [{ itemId: sinus.id }],
    });

    await OrderHistoryService.updateBranch(order.id, newBranch.id, employee);

    assert.equal((await Order.getOrFail(order.id)).branchId, newBranch.id);
    assert.isTrue(report.calledOnce);
    assert.deepEqual(report.firstCall.args[0], {
      action: "order-branch-changed",
      employee,
      customerId: customer.id,
      details: [
        { label: "Ordre-ID", value: order.id },
        { label: "Gammel filial", value: "Ullern VGS" },
        { label: "Ny filial", value: "Persbråten VGS" },
      ],
    });
  });

  test("refuses an unknown branch or order, and reports nothing", async ({ assert }) => {
    const { branch, customer, sinus } = await seedOrderWorld();
    const order = await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      orderItems: [{ itemId: sinus.id }],
    });

    await assert.rejects(() =>
      OrderHistoryService.updateBranch(order.id, fixtureId("dead"), employee),
    );
    await assert.rejects(() =>
      OrderHistoryService.updateBranch(fixtureId("dead"), branch.id, employee),
    );

    assert.equal((await Order.getOrFail(order.id)).branchId, branch.id);
    assert.isFalse(report.called);
  });
});

async function orderWith(line: Partial<OrderItemDto> = {}) {
  const { branch, customer, sinus } = await seedOrderWorld();
  const order = await createOrder({
    branchId: branch.id,
    customerId: customer.id,
    orderItems: [
      {
        itemId: sinus.id,
        periodTo: DateTime.fromISO(DEADLINE),
        handout: line.handout ?? false,
        movedToOrderId: line.movedToOrderId ?? null,
      },
    ],
  });
  return { order, customer, itemId: sinus.id };
}

test.group("OrderHistoryService.updateItemDeadline()", (group) => {
  let sandbox: sinon.SinonSandbox;
  let report: sinon.SinonStub;
  const employee = { userId: EMPLOYEE, permission: "employee" as const };
  const NEW_DEADLINE = "2027-12-01";

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
    report = sandbox.stub(EmployeeMonitoringService, "report").resolves();
  });
  group.each.teardown(() => sandbox.restore());

  test("moves the period end of the open item and reports both deadlines", async ({ assert }) => {
    const { order, customer, itemId } = await orderWith();

    await OrderHistoryService.updateItemDeadline(
      { orderId: order.id, itemId, deadline: NEW_DEADLINE },
      employee,
    );

    const [line] = (await Order.getOrFail(order.id)).orderItems;
    assert.equal(line?.periodTo?.toISODate(), NEW_DEADLINE);
    assert.isTrue(report.calledOnce);
    assert.deepEqual(report.firstCall.args[0], {
      action: "order-item-deadline-changed",
      employee,
      customerId: customer.id,
      details: [
        { label: "Bok", value: "«Sinus 1T»" },
        { label: "Ordre-ID", value: order.id },
        { label: "Gammel frist", value: "01.07.2027" },
        { label: "Ny frist", value: "01.12.2027" },
      ],
    });
  });

  test("refuses a handed-out item and a missing order", async ({ assert }) => {
    const { order, itemId } = await orderWith({ handout: true });
    await assert.rejects(() =>
      OrderHistoryService.updateItemDeadline(
        { orderId: order.id, itemId, deadline: NEW_DEADLINE },
        employee,
      ),
    );
    await assert.rejects(() =>
      OrderHistoryService.updateItemDeadline(
        { orderId: fixtureId("dead"), itemId, deadline: NEW_DEADLINE },
        employee,
      ),
    );

    const [line] = (await Order.getOrFail(order.id)).orderItems;
    assert.equal(line?.periodTo?.toISODate(), DEADLINE);
    assert.isFalse(report.called);
  });

  test("refuses an item carried on into a later order", async ({ assert }) => {
    const { order: later } = await orderWith();
    const { branchId, customerId } = later;
    const moved = await createOrder({
      branchId,
      customerId,
      orderItems: [
        {
          itemId: later.orderItems[0]?.itemId ?? "",
          periodTo: DateTime.fromISO(DEADLINE),
          movedToOrderId: later.id,
        },
      ],
    });

    await assert.rejects(() =>
      OrderHistoryService.updateItemDeadline(
        { orderId: moved.id, itemId: later.orderItems[0]?.itemId ?? "", deadline: NEW_DEADLINE },
        employee,
      ),
    );
    assert.isFalse(report.called);
  });
});

test.group("OrderHistoryService.getForCustomer()", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("presents the customer's placed orders newest first, with the catalogue title", async ({
    assert,
  }) => {
    const { branch, customer, sinus } = await seedOrderWorld();
    const older = await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      createdAt: DateTime.fromISO("2026-07-01T10:00:00Z"),
      orderItems: [{ itemId: sinus.id }],
    });
    const newer = await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      amount: 100,
      createdAt: DateTime.fromISO("2026-08-01T10:00:00Z"),
      orderItems: [{ itemId: sinus.id, amount: 100 }],
    });
    const payment = await createPayment({
      orderId: newer.id,
      method: "vipps-checkout",
      createdAt: DateTime.fromISO("2026-08-01T10:01:00Z"),
    });
    await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      placed: false,
      orderItems: [{ itemId: sinus.id }],
    });

    const entries = await OrderHistoryService.getForCustomer(customer.id, "customer");

    assert.deepEqual(
      entries.map((entry) => entry.id),
      [newer.id, older.id],
    );
    assert.equal(entries[0]?.items[0]?.title, "Sinus 1T");
    assert.deepEqual(entries[0]?.branch, { id: branch.id, name: "Ullern VGS" });
    assert.equal(entries[0]?.paymentStatus, "paid");
    assert.deepEqual(entries[0]?.payments, [
      {
        id: payment.id,
        method: "vipps-checkout",
        methodLabel: "Vipps Checkout",
        amount: 100,
        confirmed: true,
        time: "2026-08-01T10:01:00.000Z",
      },
    ]);
    assert.deepEqual(entries[1]?.payments, []);
  });

  test("pairs a legacy received book with another customer's deliver order", async ({ assert }) => {
    const { branch, customer, sinus } = await seedOrderWorld();
    const petra = await createUser({ name: "Petra" });
    const time = DateTime.fromISO("2026-08-01T10:00:00Z");
    await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      byCustomer: true,
      createdAt: time,
      orderItems: [{ itemId: sinus.id, type: "match-receive", blid: BLID }],
    });
    await createOrder({
      branchId: branch.id,
      customerId: petra.id,
      byCustomer: true,
      createdAt: time.minus({ seconds: 1 }),
      orderItems: [{ itemId: sinus.id, type: "match-deliver", blid: BLID }],
    });

    const [entry] = await OrderHistoryService.getForCustomer(customer.id, "customer");

    assert.deepEqual(entry?.items[0]?.transfer?.counterparty, {
      userId: petra.id,
      name: "Petra",
    });
  });
});
