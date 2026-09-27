import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import Delivery from "#models/delivery";
import type Order from "#models/order";
import Payment from "#models/payment";
import { OrderPlacedValidator } from "#services/orders/validation/order_placed_validator";
import { BlError } from "#shared/bl-error";
import { mock } from "#tests/test-doubles";

test.group("OrderPlacedValidator", (group) => {
  let testOrder: Order;

  const orderPlacedValidator = new OrderPlacedValidator();
  let testPayment: Payment;
  let testPayments: Payment[];
  let testDelivery: Delivery;
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    testOrder = mock<Order>({
      id: "order1",
      amount: 450,
      orderItems: [
        {
          handout: false,
          delivered: false,
          type: "buy",
          amount: 300,
          itemId: "i1",
          title: "Signatur 3",
          unitPrice: 300,
        },
        {
          handout: false,
          delivered: false,
          type: "rent",
          amount: 150,
          itemId: "i2",
          title: "Signatur 4",
          unitPrice: 300,
        },
      ],
      customerId: "customer1",
      branchId: "b1",
      byCustomer: true,
      placed: true,
    });

    testPayment = mock<Payment>({
      id: "payment1",
      method: "card",
      orderId: "order1",
      amount: 450,
      confirmed: true,
    });

    testDelivery = mock<Delivery>({
      id: "delivery1",
      orderId: "order1",
      method: "branch",
      amount: 0,
    });

    testPayments = [testPayment];

    sandbox = createSandbox();
    sandbox
      .stub(Payment, "ofOrder")
      .callsFake((orderId: string) =>
        Promise.resolve(orderId === testOrder.id ? testPayments : []),
      );

    sandbox
      .stub(Delivery, "ofOrder")
      .callsFake((orderId) => Promise.resolve(orderId === testOrder.id ? testDelivery : null));
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should resolve with true", async ({ assert }) => {
    testOrder.placed = false;

    assert.isTrue(await orderPlacedValidator.validate(testOrder));
  });

  test("should resolve with true if there are no payments attached", async ({ assert }) => {
    testPayments = [];

    return assert.doesNotReject(() => orderPlacedValidator.validate(testOrder));
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
    testPayments = [];
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
