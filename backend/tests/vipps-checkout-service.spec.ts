import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import Delivery from "#models/delivery";
import Order from "#models/order";
import Payment from "#models/payment";
import { OrderPlacedHandler } from "#services/orders/order_placed_handler";
import User from "#models/user";
import { VippsCheckoutService } from "#services/vipps/vipps_checkout_service";
import { VippsPaymentService } from "#services/vipps/vipps_payment_service";
import type { VippsCheckoutSession } from "#validators/checkout_validators";
import { createBranch } from "#tests/branch_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createUser, userDouble } from "#tests/user_fixtures";

test.group("VippsCheckoutService.update", (group) => {
  let testOrder: Order;
  let captureStub: sinon.SinonStub;
  let placeOrderStub: sinon.SinonStub;
  let sandbox: sinon.SinonSandbox;

  let successfulSession: VippsCheckoutSession;

  group.each.setup(async () => {
    const truncate = await testUtils.db().truncate();
    const [branch, customer] = await Promise.all([createBranch(), createUser()]);
    testOrder = await createOrder({
      amount: 400,
      branchId: branch.id,
      customerId: customer.id,
      byCustomer: true,
      placed: false,
    });
    successfulSession = { reference: testOrder.id, sessionState: "PaymentSuccessful" };

    sandbox = createSandbox();
    sandbox
      .stub(User, "findOrFail")
      .resolves(userDouble({ id: customer.id, name: "Ola Nordmann" }));
    sandbox.stub(User.prototype, "save").resolvesThis();
    placeOrderStub = sandbox
      .stub(OrderPlacedHandler.prototype, "placeOrder")
      .callsFake(() => Promise.resolve(testOrder));
    captureStub = sandbox.stub(VippsPaymentService.payment, "capture").resolves();
    return truncate;
  });

  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should capture the order amount when the payment succeeds", async ({ assert }) => {
    await VippsCheckoutService.update(successfulSession);

    assert.deepEqual(captureStub.args, [[testOrder.id, 40_000]]);
    assert.equal((await Order.getOrFail(testOrder.id)).checkoutState, "PaymentSuccessful");
  });

  test("should include the delivery price in the captured amount", async ({ assert }) => {
    await VippsCheckoutService.update({
      ...successfulSession,
      shippingDetails: {
        shippingMethodId: "mailbox",
        amount: { value: 7500 },
      },
    });

    assert.deepEqual(captureStub.args, [[testOrder.id, 47_500]]);
    const delivery = await Delivery.ofOrder(testOrder.id);
    assert.equal(delivery?.method, "bring");
    assert.equal(delivery?.amount, 75);
    assert.equal(delivery?.product, "3584");
    const payments = await Payment.ofOrder(testOrder.id);
    assert.deepEqual(
      payments.map(({ method, amount, confirmed }) => ({ method, amount, confirmed })),
      [{ method: "vipps-checkout", amount: 475, confirmed: false }],
    );
  });

  test("should place the order and resolve even if the capture fails", async ({ assert }) => {
    captureStub.rejects(new Error("Vipps is down"));

    await VippsCheckoutService.update(successfulSession);

    assert.equal(placeOrderStub.callCount, 1);
  });

  test("should not capture when the payment has not succeeded", async ({ assert }) => {
    await VippsCheckoutService.update({
      ...successfulSession,
      sessionState: "PaymentInitiated",
    });

    assert.equal(captureStub.callCount, 0);
  });

  test("should not capture when the order is already paid for", async ({ assert }) => {
    testOrder.checkoutState = "PaymentSuccessful";
    await testOrder.save();

    await VippsCheckoutService.update(successfulSession);

    assert.equal(captureStub.callCount, 0);
  });
});
