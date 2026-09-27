import { test } from "@japa/runner";
import { DateTime } from "luxon";

import type Order from "#models/order";
import { OrderFieldValidator } from "#services/orders/validation/order_field_validator";
import { BlError } from "#shared/bl-error";
import { mock } from "#tests/test-doubles";

test.group("OrderFieldValidator", (group) => {
  let testOrder: Order;
  const orderItemFieldValidator = new OrderFieldValidator();

  group.each.setup(() => {
    testOrder = mock<Order>({
      id: "order1",
      amount: 300,
      customerId: null,
      orderItems: [
        {
          handout: false,
          delivered: false,
          itemId: "item2",
          title: "Spinn",
          amount: 300,
          unitPrice: 600,
          type: "rent",
          periodFrom: DateTime.now(),
          periodTo: DateTime.now(),
          numberOfPeriods: 1,
          periodType: "semester",
        },
      ],
      deliveryId: "delivery1",
      branchId: "branch1",
      byCustomer: true,
      placed: false,
    });
  });

  test("should reject if order.orderItems is not defined", async ({ assert }) => {
    testOrder.orderItems.splice(0);

    return assert.rejects(
      () => orderItemFieldValidator.validate(testOrder),
      BlError,
      "order.orderItems is empty or undefined",
    );
  });

  test("should reject if orderItem.item is not defined", async ({ assert }) => {
    // @ts-expect-error fixme: auto ignored
    testOrder.orderItems[0].itemId = null;

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
