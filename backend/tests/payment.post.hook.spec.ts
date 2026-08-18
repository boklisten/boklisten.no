import { test } from "@japa/runner";
import { expect, use as chaiUse, should } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { createSandbox } from "sinon";

import { PaymentValidator } from "#services/legacy/collections/payment/helpers/payment.validator";
import { PaymentPostHook } from "#services/legacy/collections/payment/hooks/payment.post.hook";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { Order } from "#shared/order/order";
import { Payment } from "#shared/payment/payment";

chaiUse(chaiAsPromised);
should();

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
      payments: [],
    };

    testPayment = {
      id: "payment1",
      method: "later",
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
    sandbox.stub(StorageService.Payments, "update").callsFake(() => {
      return Promise.resolve(testPayment);
    });

    sandbox.stub(StorageService.Orders, "get").callsFake((id) => {
      if (id !== testOrder.id) {
        return Promise.reject(new BlError("not found").code(702));
      }

      return Promise.resolve(testOrder);
    });

    sandbox.stub(StorageService.Orders, "update").callsFake(() => {
      return Promise.resolve(testOrder);
    });

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

  test("should reject if ids is empty or undefined", async () => {
    return expect(
      // @ts-expect-error fixme: auto ignored
      paymentPostHook.after([], testAccessToken),
    ).to.eventually.be.rejectedWith(BlError, /payments is empty or undefined/);
  });

  test("should reject if paymentValidator.validate rejects", async () => {
    paymentValidated = false;

    return expect(
      // @ts-expect-error fixme: auto ignored
      paymentPostHook.after([testPayment], testAccessToken),
    ).to.be.rejectedWith(BlError, /payment could not be validated/);
  });
});
