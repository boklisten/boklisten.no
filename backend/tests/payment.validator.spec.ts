import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { PaymentValidator } from "#services/legacy/collections/payment/helpers/payment.validator";
import { StorageService } from "#services/storage_service";
import { unchecked } from "#tests/test-doubles";
import { BlError } from "#shared/bl-error";
import type { Delivery } from "#shared/delivery/delivery";
import type { Order } from "#shared/order/order";
import type { Payment } from "#shared/payment/payment";

test.group("PaymentValidator", (group) => {
  const paymentValidator = new PaymentValidator();
  let testPayment: Payment;
  let testOrder: Order;
  let testDelivery: Delivery;
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    testPayment = {
      id: "payment1",
      method: "vipps",
      order: "order1",
      info: {
        paymentId: "vipps1",
      },
      amount: 100,
      confirmed: false,
      customer: "customer1",
      branch: "branch1",
    };

    testOrder = {
      id: "order1",
      amount: 100,
      customer: "customer1",
      branch: "branch1",
      orderItems: [],
      byCustomer: true,
      placed: false,
    };

    testDelivery = {
      id: "delivery1",
      method: "bring",
      info: {
        amount: 100,
        estimatedDelivery: new Date(),
        facilityAddress: {
          address: "Martin Lingesvei 25",
          postalCode: "1364",
          postalCity: "FORNEBU",
        },
        from: "1364",
      },
      order: "order1",
      amount: 100,
    };

    sandbox = createSandbox();
    sandbox.stub(StorageService.Orders, "get").callsFake((id) => {
      if (id !== testOrder.id) {
        return Promise.reject(new BlError("order not found").code(702));
      }
      return Promise.resolve(testOrder);
    });

    sandbox
      .stub(StorageService.Deliveries, "get")
      .callsFake((id) =>
        id === testDelivery.id
          ? Promise.resolve(testDelivery)
          : Promise.reject(new BlError("delivery not found")),
      );
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("validate() - should reject if payment is undefined", async ({ assert }) =>
    assert.rejects(() => paymentValidator.validate(), BlError, /payment is not defined/));

  test("validate() - should reject if paymentMethod is not valid", async ({ assert }) =>
    assert.rejects(
      () => paymentValidator.validate(unchecked({ method: "something", order: testOrder.id })),
      BlError,
      'payment.method "something" not supported',
    ));

  test("validate() - should resolve when payment is valid", async ({ assert }) =>
    assert.doesNotReject(() => paymentValidator.validate(testPayment)));

  test("validate() - should reject if order is not found", async ({ assert }) => {
    testPayment.order = "orderNotFound";

    return assert.rejects(() => paymentValidator.validate(testPayment), BlError, /order not found/);
  });

  test("validate() - should reject if order.delivery is not found", async ({ assert }) => {
    testOrder.delivery = "notFoundDelivery";

    return assert.rejects(
      () => paymentValidator.validate(testPayment),
      BlError,
      /delivery not found/,
    );
  });

  test("validate() - should reject if payment.amount is not equal to order.amount + delivery.amount", async ({
    assert,
  }) => {
    testOrder.amount = 200;
    testPayment.amount = 200;
    testDelivery.amount = 100;
    testOrder.delivery = testDelivery.id;

    return assert.rejects(
      () => paymentValidator.validate(testPayment),
      BlError,
      /payment.amount "200" is not equal to \(order.amount \+ delivery.amount\) "300"/,
    );
  });
});
