import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { OrderPlacedValidator } from "#services/legacy/collections/order/helpers/order-validator/order-placed-validator/order-placed-validator";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { Delivery } from "#shared/delivery/delivery";
import type { Order } from "#shared/order/order";
import type { Payment } from "#shared/payment/payment";

test.group("OrderPlacedValidator", (group) => {
  let testOrder: Order;

  const orderPlacedValidator = new OrderPlacedValidator();
  let testPayment: Payment;
  let testDelivery: Delivery;
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    testOrder = {
      handoutByDelivery: false,
      id: "order1",
      amount: 450,
      orderItems: [
        {
          handout: false,
          delivered: false,
          type: "buy",
          amount: 300,
          item: "i1",
          title: "Signatur 3",
          unitPrice: 300,
        },
        {
          handout: false,
          delivered: false,
          type: "rent",
          amount: 150,
          item: "i2",
          title: "Signatur 4",
          unitPrice: 300,
        },
      ],
      customer: "customer1",
      delivery: "delivery1",
      branch: "b1",
      byCustomer: true,
      placed: true,
      payments: ["payment1"],
    };

    testPayment = {
      id: "payment1",
      method: "card",
      order: "order1",
      info: {},
      amount: 450,
      confirmed: true,
      customer: "customer1",
      branch: "branch1",
    };

    testDelivery = {
      id: "delivery1",
      method: "branch",
      info: {
        branch: "branch1",
      },
      order: "order1",
      amount: 0,
    };

    sandbox = createSandbox();
    sandbox.stub(StorageService.Payments, "getMany").callsFake(
      (ids: string[]) =>
        new Promise((resolve, reject) => {
          if (ids[0] !== "payment1") {
            reject(new BlError("not found").code(702));
            return;
          }
          resolve([testPayment]);
        }),
    );

    sandbox.stub(StorageService.Deliveries, "get").callsFake(
      (id) =>
        new Promise((resolve, reject) => {
          if (id !== "delivery1") {
            reject(new BlError("not found").code(702));
            return;
          }

          resolve(testDelivery);
        }),
    );
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should resolve with true", async ({ assert }) => {
    testOrder.placed = false;

    assert.isTrue(await orderPlacedValidator.validate(testOrder));
  });

  test("should resolve with true if there are no payments attached", async ({ assert }) => {
    testOrder.payments = [];

    return assert.doesNotReject(() => orderPlacedValidator.validate(testOrder));
  });

  test("should reject with error if delivery is not found", async ({ assert }) => {
    testOrder.delivery = "notFoundDelivery";
    await assert.rejects(
      () => orderPlacedValidator.validate(testOrder),
      BlError,
      /delivery "notFoundDelivery" not found/,
    );
  });

  test("should reject with error if payments is not found", async ({ assert }) => {
    testOrder.payments = ["notFound"];
    await assert.rejects(
      () => orderPlacedValidator.validate(testOrder),
      BlError,
      /order.payments is not found/,
    );
  });

  test("should reject with error if payment.confirmed is false", async ({ assert }) => {
    testPayment.confirmed = false;
    await assert.rejects(
      () => orderPlacedValidator.validate(testOrder),
      BlError,
      /payment is not confirmed/,
    );
  });

  test("should reject with error if total amount in payments is not equal to order.amount + delivery.amount", async ({
    assert,
  }) => {
    testOrder.amount = 450;
    testDelivery.amount = 40;
    testPayment.amount = 100;
    await assert.rejects(
      () => orderPlacedValidator.validate(testOrder),
      BlError,
      /total amount of payments is not equal to total of order.amount \+ delivery.amount/,
    );
  });

  test("should reject with error if total amount in order.orderItems is not equal to order.amount", async ({
    assert,
  }) => {
    testOrder.payments = [];

    // @ts-expect-error fixme: auto ignored
    testOrder.delivery = null;
    testOrder.amount = 999;
    await assert.rejects(
      () => orderPlacedValidator.validate(testOrder),
      BlError,
      /total of order.orderItems amount is not equal to order.amount/,
    );
  });

  test("should resolve if delivery and payments are valid according to order information", async ({
    assert,
  }) => {
    assert.isTrue(await orderPlacedValidator.validate(testOrder));
  });
});
