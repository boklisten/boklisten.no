import { test } from "@japa/runner";
import { expect, use as chaiUse, should } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { createSandbox } from "sinon";

import { OrderPlacedHandler } from "#services/legacy/collections/order/helpers/order-placed-handler/order-placed-handler";
import { StorageService } from "#services/storage_service";
import { VippsCheckoutService } from "#services/vipps/vipps_checkout_service";
import { VippsPaymentService } from "#services/vipps/vipps_payment_service";
import { Order } from "#shared/order/order";
import { Payment } from "#shared/payment/payment";
import { UserDetail } from "#shared/user-detail";
import { VippsCheckoutSession } from "#validators/checkout_validators";

chaiUse(chaiAsPromised);
should();

test.group("VippsCheckoutService.update", (group) => {
  let testOrder: Order;
  let captureStub: sinon.SinonStub;
  let placeOrderStub: sinon.SinonStub;
  let sandbox: sinon.SinonSandbox;

  const successfulSession: VippsCheckoutSession = {
    reference: "order1",
    sessionState: "PaymentSuccessful",
  };

  group.each.setup(() => {
    testOrder = {
      id: "order1",
      amount: 400,
      orderItems: [],
      branch: "branch1",
      customer: "customer1",
      byCustomer: true,
      pendingSignature: false,
    } as unknown as Order;

    sandbox = createSandbox();
    sandbox.stub(StorageService.Orders, "get").callsFake(() => Promise.resolve(testOrder));
    sandbox
      .stub(StorageService.Orders, "update")
      .callsFake((_id, data) => Promise.resolve({ ...testOrder, ...data }));
    sandbox.stub(StorageService.UserDetails, "get").resolves({
      id: "customer1",
      name: "Ola Nordmann",
    } as UserDetail);
    sandbox
      .stub(StorageService.Payments, "add")
      .callsFake((payment) => Promise.resolve({ ...payment, id: "payment1" } as Payment));
    sandbox
      .stub(StorageService.Deliveries, "add")
      .callsFake((delivery) => Promise.resolve({ ...delivery, id: "delivery1" }));
    placeOrderStub = sandbox
      .stub(OrderPlacedHandler.prototype, "placeOrder")
      .callsFake(() => Promise.resolve(testOrder));
    captureStub = sandbox.stub(VippsPaymentService.payment, "capture").resolves();
  });

  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should capture the order amount when the payment succeeds", async () => {
    await VippsCheckoutService.update(successfulSession);

    expect(captureStub.args).to.deep.equal([["order1", 40_000]]);
  });

  test("should include the delivery price in the captured amount", async () => {
    await VippsCheckoutService.update({
      ...successfulSession,
      shippingDetails: {
        shippingMethodId: "mailbox",
        amount: { value: 7500 },
      },
    });

    expect(captureStub.args).to.deep.equal([["order1", 47_500]]);
  });

  test("should place the order and resolve even if the capture fails", async () => {
    captureStub.rejects(new Error("Vipps is down"));

    await VippsCheckoutService.update(successfulSession);

    expect(placeOrderStub.callCount).to.equal(1);
  });

  test("should not capture when the payment has not succeeded", async () => {
    await VippsCheckoutService.update({
      ...successfulSession,
      sessionState: "PaymentInitiated",
    });

    expect(captureStub.callCount).to.equal(0);
  });

  test("should not capture when the order is already paid for", async () => {
    testOrder.checkoutState = "PaymentSuccessful";

    await VippsCheckoutService.update(successfulSession);

    expect(captureStub.callCount).to.equal(0);
  });
});
