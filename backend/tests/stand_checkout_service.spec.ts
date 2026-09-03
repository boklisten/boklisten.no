import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import BadRequestException from "#exceptions/bad_request_exception";
import { OrderPlacedHandler } from "#services/legacy/collections/order/helpers/order-placed-handler/order-placed-handler";
import { OrderHistoryService } from "#services/order_history_service";
import { OrderService } from "#services/order_service";
import { StandCheckoutService, toMsisdn } from "#services/stand_checkout_service";
import { StorageService } from "#services/storage_service";
import { VippsPaymentService } from "#services/vipps/vipps_payment_service";
import type { Branch } from "#shared/branch";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Item } from "#shared/item";
import type { Order } from "#shared/order/order";
import type { OrderItem } from "#shared/order/order-item/order-item";
import { mock, unchecked } from "#tests/test-doubles";

const CUSTOMER_ID = "6100000000000000000000c1";
const EMPLOYEE_ID = "6100000000000000000000e1";
const ORDER_ID = "61000000000000000000000d";
const DEADLINE = new Date("2027-01-15T00:00:00.000Z");
const EXTEND_TO = new Date("2027-07-01T00:00:00.000Z");

function activeCustomerItem(overrides: Partial<CustomerItem> = {}): CustomerItem {
  return mock<CustomerItem>({
    id: "ci1",
    item: "item1",
    customer: CUSTOMER_ID,
    deadline: DEADLINE,
    handout: true,
    returned: false,
    buyout: false,
    cancel: false,
    buyback: false,
    orders: [],
    // Handed out long ago, so the two-week buyout rule does not get in the way
    creationTime: new Date("2026-01-01T00:00:00.000Z"),
    handoutInfo: { handoutBy: "branch", handoutById: "branch1", time: new Date() },
    ...overrides,
  });
}

const branch = mock<Branch>({
  id: "branch1",
  paymentInfo: {
    responsible: false,
    rentPeriods: [],
    extendPeriods: [{ type: "semester", date: EXTEND_TO, maxNumberOfPeriods: 1, price: 150 }],
    buyout: { percentage: 0.5 },
  },
});

function orderWith(overrides: Partial<Order> = {}): Order {
  return mock<Order>({
    id: ORDER_ID,
    amount: 410,
    customer: CUSTOMER_ID,
    branch: "branch1",
    placed: false,
    byCustomer: false,
    payments: [],
    orderItems: [{ type: "buyout", item: "item1", title: "Kjemien stemmer", amount: 410 }],
    ...overrides,
  });
}

test.group("StandCheckoutService", (group) => {
  let sandbox: sinon.SinonSandbox;
  let createFromCart: sinon.SinonStub;
  let placeOrder: sinon.SinonStub;
  let paymentsAdd: sinon.SinonStub;
  let ordersUpdate: sinon.SinonStub;
  let ordersGet: sinon.SinonStub;
  let vipps: {
    create: sinon.SinonStub;
    info: sinon.SinonStub;
    cancel: sinon.SinonStub;
    capture: sinon.SinonStub;
  };

  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox.stub(StorageService, "CustomerItems").value({
      getOrNull: sandbox.stub().resolves(activeCustomerItem()),
    });
    sandbox.stub(StorageService, "Branches").value({ getOrNull: sandbox.stub().resolves(branch) });
    sandbox.stub(StorageService, "Items").value({
      getOrNull: sandbox.stub().resolves(mock<Item>({ id: "item1", price: 829 })),
    });
    ordersGet = sandbox.stub().resolves(orderWith({ checkoutState: "SessionCreated" }));
    ordersUpdate = sandbox
      .stub()
      .callsFake((id: string, data: Partial<Order>) => Promise.resolve(orderWith(data)));
    sandbox.stub(StorageService, "Orders").value({
      getOrNull: sandbox.stub().resolves(null),
      get: ordersGet,
      update: ordersUpdate,
    });
    paymentsAdd = sandbox.stub().resolves({ id: "payment1" });
    sandbox.stub(StorageService, "Payments").value({ add: paymentsAdd });
    createFromCart = sandbox.stub(OrderService, "createFromCart").resolves(orderWith());
    placeOrder = sandbox
      .stub(OrderPlacedHandler.prototype, "placeOrder")
      .resolves(orderWith({ placed: true }));
    sandbox.stub(OrderHistoryService, "getOne").resolves(unchecked({ id: ORDER_ID }));
    vipps = {
      create: sandbox.stub().resolves({ reference: ORDER_ID }),
      info: sandbox.stub().resolves({ state: "CREATED" }),
      cancel: sandbox.stub().resolves({}),
      capture: sandbox.stub().resolves({}),
    };
    sandbox.stub(VippsPaymentService, "payment").value(vipps);
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("a card buyout is recorded as the employee's order, paid in full and placed at once", async ({
    assert,
  }) => {
    const result = await StandCheckoutService.start({
      customerItemId: "ci1",
      action: { type: "buyout" },
      payment: { method: "card" },
      employeeDetailsId: EMPLOYEE_ID,
    });

    assert.deepEqual(createFromCart.firstCall.args, [
      CUSTOMER_ID,
      [{ id: "item1", branchId: "branch1", type: "buyout" }],
      { byCustomer: false, employee: EMPLOYEE_ID },
    ]);
    assert.include(paymentsAdd.firstCall.args[0], {
      method: "card",
      amount: 410,
      order: ORDER_ID,
      confirmed: false,
    });
    assert.deepEqual(ordersUpdate.firstCall.args, [ORDER_ID, { payments: ["payment1"] }]);
    assert.isTrue(placeOrder.calledOnce);
    assert.isFalse(vipps.create.called);
    assert.equal(result.status, "paid");
    assert.isNotNull(result.order);
  });

  test("a Vipps extension pushes a request to the customer's phone and leaves the order pending", async ({
    assert,
  }) => {
    createFromCart.resolves(
      orderWith({
        amount: 150,
        orderItems: [
          mock<OrderItem>({ type: "extend", item: "item1", title: "Kjemien stemmer", amount: 150 }),
        ],
      }),
    );

    const result = await StandCheckoutService.start({
      customerItemId: "ci1",
      action: { type: "extend", to: EXTEND_TO },
      payment: { method: "vipps", phoneNumber: "+47 912 34 567" },
      employeeDetailsId: EMPLOYEE_ID,
    });

    assert.deepEqual(createFromCart.firstCall.args[1], [
      { id: "item1", branchId: "branch1", type: "extend", to: EXTEND_TO },
    ]);
    assert.include(vipps.create.firstCall.args[0], {
      reference: ORDER_ID,
      userFlow: "PUSH_MESSAGE",
      customerInteraction: "CUSTOMER_PRESENT",
      paymentDescription: "Forleng «Kjemien stemmer» til 01/07/2027",
    });
    assert.deepEqual(vipps.create.firstCall.args[0].amount, { currency: "NOK", value: 15_000 });
    assert.deepEqual(vipps.create.firstCall.args[0].customer, { phoneNumber: "4791234567" });
    assert.deepEqual(ordersUpdate.firstCall.args, [ORDER_ID, { checkoutState: "SessionCreated" }]);
    assert.isFalse(placeOrder.called);
    assert.isFalse(paymentsAdd.called);
    assert.equal(result.status, "pending");
    assert.isNull(result.order);
  });

  test("a number without a Vipps user is reported to the employee and the order is dropped", async ({
    assert,
  }) => {
    const ordersRemove = sandbox.stub().resolves();
    sandbox.stub(StorageService, "Orders").value({
      getOrNull: sandbox.stub().resolves(null),
      get: ordersGet,
      update: ordersUpdate,
      remove: ordersRemove,
    });
    vipps.create.rejects(
      new Error(
        JSON.stringify({
          title: "Customer not found",
          extraDetails: [{ name: "ErrorCode", reason: "7010" }],
        }),
      ),
    );
    await assert.rejects(
      () =>
        StandCheckoutService.start({
          customerItemId: "ci1",
          action: { type: "buyout" },
          payment: { method: "vipps", phoneNumber: "91234567" },
          employeeDetailsId: EMPLOYEE_ID,
        }),
      BadRequestException,
      /ikke registrert i Vipps/,
    );
    assert.isTrue(ordersRemove.calledWith(ORDER_ID));
    assert.isFalse(placeOrder.called);
  });

  test("a free order is placed straight away without asking Vipps or recording a payment", async ({
    assert,
  }) => {
    createFromCart.resolves(orderWith({ amount: 0 }));

    const result = await StandCheckoutService.start({
      customerItemId: "ci1",
      action: { type: "buyout" },
      payment: { method: "vipps", phoneNumber: "91234567" },
      employeeDetailsId: EMPLOYEE_ID,
    });

    assert.isFalse(vipps.create.called);
    assert.isFalse(paymentsAdd.called);
    assert.isTrue(placeOrder.calledOnce);
    assert.equal(result.status, "paid");
  });

  test("rejects a bad phone number before any order exists", async ({ assert }) => {
    await assert.rejects(
      () =>
        StandCheckoutService.start({
          customerItemId: "ci1",
          action: { type: "buyout" },
          payment: { method: "vipps", phoneNumber: "12345" },
          employeeDetailsId: EMPLOYEE_ID,
        }),
      BadRequestException,
    );
    assert.isFalse(createFromCart.called);
  });

  test("applies the customer's own rules: a book held under two weeks cannot be bought out", async ({
    assert,
  }) => {
    sandbox.stub(StorageService, "CustomerItems").value({
      getOrNull: sandbox.stub().resolves(activeCustomerItem({ creationTime: new Date() })),
    });
    await assert.rejects(
      () =>
        StandCheckoutService.start({
          customerItemId: "ci1",
          action: { type: "buyout" },
          payment: { method: "card" },
          employeeDetailsId: EMPLOYEE_ID,
        }),
      BadRequestException,
      /minst 2 uker/,
    );
    assert.isFalse(createFromCart.called);
  });

  test("refuses to extend to a date the branch does not offer", async ({ assert }) => {
    await assert.rejects(
      () =>
        StandCheckoutService.start({
          customerItemId: "ci1",
          action: { type: "extend", to: new Date("2027-05-05T00:00:00.000Z") },
          payment: { method: "card" },
          employeeDetailsId: EMPLOYEE_ID,
        }),
      BadRequestException,
      /denne datoen/,
    );
    assert.isFalse(createFromCart.called);
  });

  test("status reports a placed order as paid without asking Vipps again", async ({ assert }) => {
    ordersGet.resolves(orderWith({ placed: true, checkoutState: "PaymentSuccessful" }));
    const result = await StandCheckoutService.status(ORDER_ID);
    assert.equal(result.status, "paid");
    assert.isFalse(vipps.info.called);
  });

  test("status settles an approved request: payment recorded, order placed, funds captured", async ({
    assert,
  }) => {
    vipps.info.resolves({ state: "AUTHORIZED" });
    const result = await StandCheckoutService.status(ORDER_ID);

    assert.include(paymentsAdd.firstCall.args[0], { method: "vipps-epayment", amount: 410 });
    assert.isTrue(placeOrder.calledOnce);
    assert.isTrue(ordersUpdate.calledWith(ORDER_ID, { checkoutState: "PaymentSuccessful" }));
    assert.deepEqual(vipps.capture.firstCall.args, [ORDER_ID, 41_000]);
    assert.equal(result.status, "paid");
    assert.isNotNull(result.order);
  });

  test("status keeps waiting while the customer has not answered", async ({ assert }) => {
    const result = await StandCheckoutService.status(ORDER_ID);
    assert.equal(result.status, "pending");
    assert.isFalse(placeOrder.called);
  });

  test("status remembers a declined request so the next poll does not ask Vipps", async ({
    assert,
  }) => {
    vipps.info.resolves({ state: "ABORTED" });
    const first = await StandCheckoutService.status(ORDER_ID);
    assert.equal(first.status, "aborted");
    assert.isTrue(ordersUpdate.calledWith(ORDER_ID, { checkoutState: "PaymentTerminated" }));

    ordersGet.resolves(orderWith({ checkoutState: "PaymentTerminated" }));
    vipps.info.resetHistory();
    const second = await StandCheckoutService.status(ORDER_ID);
    assert.equal(second.status, "aborted");
    assert.isFalse(vipps.info.called);
  });

  test("cancel withdraws the pending request", async ({ assert }) => {
    const result = await StandCheckoutService.cancel(ORDER_ID);
    assert.deepEqual(vipps.cancel.firstCall.args, [ORDER_ID]);
    assert.equal(result.status, "cancelled");
    assert.isFalse(placeOrder.called);
  });

  test("cancel settles the order instead when the customer approved just before", async ({
    assert,
  }) => {
    vipps.cancel.rejects(new Error("already authorized"));
    vipps.info.resolves({ state: "AUTHORIZED" });
    const result = await StandCheckoutService.cancel(ORDER_ID);
    assert.equal(result.status, "paid");
    assert.isTrue(placeOrder.calledOnce);
  });
});

test.group("toMsisdn", () => {
  test("accepts Norwegian numbers with or without the country code and spacing", ({ assert }) => {
    assert.equal(toMsisdn("91234567"), "4791234567");
    assert.equal(toMsisdn("+47 912 34 567"), "4791234567");
    assert.equal(toMsisdn("4791234567"), "4791234567");
  });

  test("rejects anything that is not eight subscriber digits", ({ assert }) => {
    assert.throws(() => toMsisdn("12345"), BadRequestException);
    assert.throws(() => toMsisdn("4512345678"), BadRequestException);
  });
});
