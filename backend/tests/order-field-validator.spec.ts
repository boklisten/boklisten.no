import { test } from "@japa/runner";

import { OrderFieldValidator } from "#services/legacy/collections/order/helpers/order-validator/order-field-validator/order-field-validator";
import { BlError } from "#shared/bl-error";
import { Order } from "#shared/order/order";

test.group("OrderFieldValidator", (group) => {
  let testOrder: Order;
  const orderItemFieldValidator = new OrderFieldValidator();

  group.each.setup(() => {
    testOrder = {
      id: "order1",
      amount: 300,
      customer: "",
      orderItems: [
        {
          item: "item2",
          title: "Spinn",
          amount: 300,
          unitPrice: 600,
          type: "rent",
          info: {
            from: new Date(),
            to: new Date(),
            numberOfPeriods: 1,
            periodType: "semester",
          },
        },
      ],
      delivery: "delivery1",
      branch: "branch1",
      byCustomer: true,
      placed: false,
      payments: ["payment1"],
    };
  });

  test("should reject if order.orderItems is not defined", async ({ assert }) => {
    testOrder.orderItems = [];

    return assert.rejects(
      () => orderItemFieldValidator.validate(testOrder),
      BlError,
      "order.orderItems is empty or undefined",
    );
  });

  test("should reject if orderItem.item is not defined", async ({ assert }) => {
    // @ts-expect-error fixme: auto ignored
    testOrder.orderItems[0].item = null;

    return assert.rejects(
      () => orderItemFieldValidator.validate(testOrder),
      BlError,
      /orderItem.item is not defined/,
    );
  });

  test("should reject if orderItem.title is not defined", async ({ assert }) => {
    // @ts-expect-error fixme: auto ignored
    testOrder.orderItems[0].title = undefined;

    return assert.rejects(
      () => orderItemFieldValidator.validate(testOrder),
      BlError,
      /orderItem.title is not defined/,
    );
  });

  test("should reject if orderItem.amount is not defined", async ({ assert }) => {
    // @ts-expect-error fixme: auto ignored
    testOrder.orderItems[0].amount = undefined;

    return assert.rejects(
      () => orderItemFieldValidator.validate(testOrder),
      BlError,
      /orderItem.amount is not defined/,
    );
  });

  test("should reject if orderItem.unitPrice is not defined", async ({ assert }) => {
    // @ts-expect-error fixme: auto ignored
    testOrder.orderItems[0].unitPrice = null;

    return assert.rejects(
      () => orderItemFieldValidator.validate(testOrder),
      BlError,
      /orderItem.unitPrice is not defined/,
    );
  });

  test("should reject if orderItem.type is not defined", async ({ assert }) => {
    // @ts-expect-error fixme: auto ignored
    testOrder.orderItems[0].type = null;

    return assert.rejects(
      () => orderItemFieldValidator.validate(testOrder),
      BlError,
      /orderItem.type is not defined/,
    );
  });
});
