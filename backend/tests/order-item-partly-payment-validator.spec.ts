import { test } from "@japa/runner";
import { DateTime } from "luxon";

import type OrderItem from "#models/order_item";
import { OrderItemPartlyPaymentValidator } from "#services/orders/validation/order_item_partly_payment_validator";
import { BlError } from "#shared/bl-error";
import type { Item } from "#shared/item";
import { branchDto } from "#tests/branch_fixtures";
import { mock } from "#tests/test-doubles";

test.group("OrderItemPartlyPaymentValidator", async () => {
  const orderItemPartlyPaymentValidator = new OrderItemPartlyPaymentValidator();

  test('should reject if orderItem.type is not "partly-payment"', async ({ assert }) => {
    const orderItem = mock<OrderItem>({
      handout: false,
      delivered: false,
      type: "buy",
      itemId: "item1",
      amount: 100,
      unitPrice: 100,
    });

    const item = mock<Item>({
      title: "someTitle",
    });

    const branch = {
      name: "some branch",
    };

    return assert.rejects(
      () => orderItemPartlyPaymentValidator.validate(orderItem, item, branchDto(branch)),
      BlError,
    );
  });

  test("should reject if orderItem.periodTo is not specified", async ({ assert }) => {
    const orderItem = mock<OrderItem>({
      type: "partly-payment",
      periodFrom: DateTime.now(),
      periodTo: null,
    });

    return assert.rejects(
      () => orderItemPartlyPaymentValidator.validate(orderItem, mock<Item>(), branchDto()),
      BlError,
      /orderItem.periodTo not specified/,
    );
  });

  test("should reject if orderItem.amountLeftToPay is not specified", async ({ assert }) => {
    const orderItem = mock<OrderItem>({
      type: "partly-payment",
      periodFrom: DateTime.now(),
      periodTo: DateTime.now(),
      amountLeftToPay: null,
    });

    return assert.rejects(
      () => orderItemPartlyPaymentValidator.validate(orderItem, mock<Item>(), branchDto()),
      BlError,
      /orderItem.amountLeftToPay not specified/,
    );
  });

  test("should reject if orderItem.periodType is not allowed on branch", async ({ assert }) => {
    const orderItem = mock<OrderItem>({
      type: "partly-payment",
      itemId: "someItem",
      periodFrom: DateTime.now(),
      periodTo: DateTime.now(),
      amountLeftToPay: 100,
      periodType: "year",
    });

    return assert.rejects(
      () => orderItemPartlyPaymentValidator.validate(orderItem, mock<Item>(), branchDto()),
      BlError,
      /partly-payment period "year" not supported on branch/,
    );
  });
});
