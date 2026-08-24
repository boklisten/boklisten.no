import { test } from "@japa/runner";

import { OrderItemPartlyPaymentValidator } from "#services/legacy/collections/order/helpers/order-validator/order-item-validator/order-item-partly-payment-validator/order-item-partly-payment-validator";
import { BlError } from "#shared/bl-error";
import { Branch } from "#shared/branch";
import { Item } from "#shared/item";
import { OrderItem } from "#shared/order/order-item/order-item";

test.group("OrderItemPartlyPaymentValidator", async () => {
  const orderItemPartlyPaymentValidator = new OrderItemPartlyPaymentValidator();

  test('should reject if orderItem.type is not "partly-payment"', async ({ assert }) => {
    const orderItem: OrderItem = {
      type: "buy",
      item: "item1",
      title: "someTitle",
      amount: 100,
      unitPrice: 100,
    };

    const item = {
      title: "someTitle",
    };

    const branch = {
      name: "some branch",
    };

    return assert.rejects(
      () => orderItemPartlyPaymentValidator.validate(orderItem, item as Item, branch as Branch),
      BlError,
    );
  });

  test("should reject if orderItem.info.to is not specified", async ({ assert }) => {
    const orderItem = {
      type: "partly-payment",
      info: {
        from: new Date(),
      },
    };

    return assert.rejects(
      () =>
        orderItemPartlyPaymentValidator.validate(orderItem as OrderItem, {} as Item, {} as Branch),
      BlError,
      /orderItem.info.to not specified/,
    );
  });

  test("should reject if orderItem.info.amountLeftToPay is not specified", async ({ assert }) => {
    const orderItem = {
      type: "partly-payment",
      info: {
        to: new Date(),
        from: new Date(),
      },
    };

    return assert.rejects(
      () =>
        orderItemPartlyPaymentValidator.validate(orderItem as OrderItem, {} as Item, {} as Branch),
      BlError,
      /orderItem.info.amountLeftToPay not specified/,
    );
  });

  test("should reject if orderItem.info is not specified", async ({ assert }) => {
    const orderItem = {
      type: "partly-payment",
    };

    return assert.rejects(
      () =>
        orderItemPartlyPaymentValidator.validate(orderItem as OrderItem, {} as Item, {} as Branch),
      BlError,
      /orderItem.info not specified/,
    );
  });

  test("should reject if orderItem.info.period is not allowed on branch", async ({ assert }) => {
    const orderItem = {
      type: "partly-payment",
      item: "someItem",
      info: {
        to: new Date(),
        from: new Date(),
        amountLeftToPay: 100,
        periodType: "year",
      },
    };

    return assert.rejects(
      () =>
        orderItemPartlyPaymentValidator.validate(orderItem as OrderItem, {} as Item, {} as Branch),
      BlError,
      /partly-payment period "year" not supported on branch/,
    );
  });
});
