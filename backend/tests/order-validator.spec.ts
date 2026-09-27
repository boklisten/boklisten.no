import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import type sinon from "sinon";
import { createSandbox } from "sinon";
import { DateTime } from "luxon";

import type Order from "#models/order";
import { OrderFieldValidator } from "#services/orders/validation/order_field_validator";
import { OrderItemValidator } from "#services/orders/validation/order_item_validator";
import { OrderPlacedValidator } from "#services/orders/validation/order_placed_validator";
import { OrderUserDetailValidator } from "#services/orders/validation/order_user_detail_validator";
import { OrderValidator } from "#services/orders/validation/order_validator";
import { BlError } from "#shared/bl-error";
import type { Branch } from "#shared/branch";
import { branchDto, createBranch } from "#tests/branch_fixtures";
import { mock } from "#tests/test-doubles";

test.group("OrderValidator", (group) => {
  let testOrder: Order;
  let testBranch: Branch;

  const orderUserDetailValidator = new OrderUserDetailValidator();

  const orderItemValidator = new OrderItemValidator();
  const orderPlacedValidator = new OrderPlacedValidator();
  const orderFieldValidator = new OrderFieldValidator();
  const orderValidator: OrderValidator = new OrderValidator(
    orderItemValidator,
    orderPlacedValidator,
    orderFieldValidator,
    orderUserDetailValidator,
  );

  // @ts-expect-error fixme: auto ignored
  let orderItemShouldResolve;

  // @ts-expect-error fixme: auto ignored
  let orderPlacedShouldResolve;

  // @ts-expect-error fixme: auto ignored
  let orderUserDetailValidatorShouldResolve;
  let sandbox: sinon.SinonSandbox;
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    sandbox = createSandbox();

    sandbox.stub(orderItemValidator, "validate").callsFake(() => {
      // @ts-expect-error fixme: auto ignored
      if (!orderItemShouldResolve) {
        return Promise.reject(new BlError("orderItems not valid"));
      }
      return Promise.resolve(true);
    });

    sandbox.stub(orderPlacedValidator, "validate").callsFake(() => {
      // @ts-expect-error fixme: auto ignored
      if (!orderPlacedShouldResolve) {
        return Promise.reject(new BlError("validation of order.placed failed"));
      }
      return Promise.resolve(true);
    });

    sandbox.stub(orderUserDetailValidator, "validate").callsFake(() => {
      // @ts-expect-error fixme: auto ignored
      if (!orderUserDetailValidatorShouldResolve) {
        return Promise.reject(new BlError("validation of UserDetail failed"));
      }

      return Promise.resolve(true);
    });

    orderItemShouldResolve = true;
    orderPlacedShouldResolve = true;
    orderUserDetailValidatorShouldResolve = true;

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
      branchId: "branch1",
      byCustomer: true,
      placed: false,
    });

    testBranch = branchDto({
      id: "branch1",
      type: "privatist",
      name: "Sonans",
      rentPeriods: [{ type: "semester", date: new Date(), maxNumberOfPeriods: 2, percentage: 0.5 }],
      extendPeriods: [
        { type: "semester", price: 100, date: new Date(), maxNumberOfPeriods: 1, percentage: null },
      ],
      buyoutPercentage: 0.5,
      region: "unknown",
    });
    await createBranch(testBranch);
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should reject if amount is null or undefined", async ({ assert }) => {
    // @ts-expect-error fixme: auto ignored
    testOrder.amount = undefined;
    return assert.rejects(
      () => orderValidator.validate(testOrder, false),
      BlError,
      /order.amount is undefined/,
    );
  });

  test("should reject if branch is not found", async ({ assert }) => {
    testOrder.branchId = "notFoundBranch";

    return assert.rejects(
      () => orderValidator.validate(testOrder, false),
      BlError,
      /order could not be validated/,
    );
  });

  test("should reject if orderItems is empty or undefined", async ({ assert }) => {
    testOrder.orderItems.splice(0);
    return assert.rejects(
      () => orderValidator.validate(testOrder, false),
      BlError,
      /order.orderItems is empty or undefined/,
    );
  });

  test("should reject if orderItemValidator rejects", async ({ assert }) => {
    orderItemShouldResolve = false;

    return assert.rejects(
      () => orderValidator.validate(testOrder, false),
      BlError,
      /orderItems not valid/,
    );
  });

  test("should reject if orderPlacedValidator rejects", async ({ assert }) => {
    orderPlacedShouldResolve = false;

    return assert.rejects(
      () => orderValidator.validate(testOrder, false),
      BlError,
      /validation of order.placed failed/,
    );
  });

  test("should reject if orderUserDetailValidator rejects", async ({ assert }) => {
    orderUserDetailValidatorShouldResolve = false;

    return assert.rejects(
      () => orderValidator.validate(testOrder, false),
      BlError,
      /validation of UserDetail failed/,
    );
  });
});
