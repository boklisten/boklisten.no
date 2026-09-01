import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { PaymentValidator } from "#services/legacy/collections/payment/helpers/payment.validator";
import { PaymentPostHook } from "#services/legacy/collections/payment/hooks/payment.post.hook";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { Order } from "#shared/order/order";
import type { Payment } from "#shared/payment/payment";
import { asStub } from "#tests/test-doubles";

test.group("PaymentPostHook", (group) => {
  const paymentValidator = new PaymentValidator();
  const paymentPostHook = new PaymentPostHook(paymentValidator);

  let testOrder: Order;
  let testPayment: Payment;

  // @ts-expect-error fixme: auto ignored
  let testAccessToken;
  let paymentValidated: boolean;
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    testOrder = {
      id: "order1",
      amount: 100,
      orderItems: [],
      branch: "branch1",
      customer: "customer1",
      byCustomer: true,
      placed: false,
      payments: [],
    };

    testPayment = {
      id: "payment1",
      method: "card",
      confirmed: false,
      order: "order1",
      amount: 0,
      customer: "customer1",
      branch: "branch1",
    };

    testAccessToken = {
      sub: "user1",
      permission: "customer",
    };

    paymentValidated = true;
    sandbox = createSandbox();

    sandbox.stub(StorageService.Payments, "get").callsFake((id) => {
      if (id !== testPayment.id) {
        return Promise.reject(new BlError("not found").code(702));
      }

      return Promise.resolve(testPayment);
    });
    sandbox.stub(StorageService.Payments, "update").callsFake(() => Promise.resolve(testPayment));

    sandbox.stub(StorageService.Orders, "get").callsFake((id) => {
      if (id !== testOrder.id) {
        return Promise.reject(new BlError("not found").code(702));
      }

      return Promise.resolve(testOrder);
    });

    sandbox.stub(StorageService.Orders, "update").callsFake(() => Promise.resolve(testOrder));

    sandbox.stub(paymentValidator, "validate").callsFake(() => {
      if (!paymentValidated) {
        return Promise.reject(new BlError("could not validate payment"));
      }

      return Promise.resolve(true);
    });
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should reject if ids is empty or undefined", async ({ assert }) =>
    assert.rejects(
      () =>
        // @ts-expect-error fixme: auto ignored
        paymentPostHook.after([], testAccessToken),
      BlError,
      /payments is empty or undefined/,
    ));

  test("should reject if paymentValidator.validate rejects", async ({ assert }) => {
    paymentValidated = false;

    return assert.rejects(
      () =>
        // @ts-expect-error fixme: auto ignored
        paymentPostHook.after([testPayment], testAccessToken),
      BlError,
      /payment could not be validated/,
    );
  });

  test("should add payment id to order.payments", async ({ assert }) => {
    const orderUpdateStub = asStub(StorageService.Orders.update);

    // @ts-expect-error fixme: auto ignored
    await paymentPostHook.after([testPayment], testAccessToken);

    assert.equal(orderUpdateStub.callCount, 1);
    assert.equal(orderUpdateStub.firstCall.args[0], testOrder.id);
    assert.deepEqual(orderUpdateStub.firstCall.args[1], {
      payments: [testPayment.id],
    });
  });

  test("should reject if order.payments already includes the payment id", async ({ assert }) => {
    testOrder.payments = [testPayment.id];

    return assert.rejects(
      () =>
        // @ts-expect-error fixme: auto ignored
        paymentPostHook.after([testPayment], testAccessToken),
      BlError,
      /order.payments already includes payment/,
    );
  });
});
