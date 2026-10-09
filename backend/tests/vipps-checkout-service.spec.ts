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
import { createUser } from "#tests/user_fixtures";

test.group("VippsCheckoutService.update", (group) => {
  let testOrder: Order;
  let customer: User;
  let captureStub: sinon.SinonStub;
  let placeOrderStub: sinon.SinonStub;
  let sandbox: sinon.SinonSandbox;

  let successfulSession: VippsCheckoutSession;

  group.each.setup(async () => {
    const truncate = await testUtils.db().truncate();
    const [branch, createdCustomer] = await Promise.all([createBranch(), createUser()]);
    customer = createdCustomer;
    testOrder = await createOrder({
      amount: 400,
      branchId: branch.id,
      customerId: customer.id,
      byCustomer: true,
      placed: false,
    });
    successfulSession = { reference: testOrder.id, sessionState: "PaymentSuccessful" };

    sandbox = createSandbox();
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

  test("should address the shipment from the billing details without editing the account", async ({
    assert,
  }) => {
    const before = await User.findOrFail(customer.id);

    await VippsCheckoutService.update({
      ...successfulSession,
      billingDetails: {
        firstName: "Kari",
        lastName: "Angriper",
        email: "angriper@example.com",
        phoneNumber: "4799999999",
        streetAddress: "Storgata 1",
        postalCode: "0155",
        city: "OSLO",
      },
      shippingDetails: { shippingMethodId: "mailbox", amount: { value: 7500 } },
    });

    const after = await User.findOrFail(customer.id);
    assert.deepEqual(
      [after.name, after.email, after.phone, after.address, after.postalCode],
      [before.name, before.email, before.phone, before.address, before.postalCode],
    );
    const delivery = await Delivery.ofOrder(testOrder.id);
    assert.equal(delivery?.shipmentName, "Kari Angriper");
    assert.equal(delivery?.shipmentAddress, "Storgata 1");
    assert.equal(delivery?.toPostalCode, "0155");
  });
});
