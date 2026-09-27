import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";
import { DateTime } from "luxon";

import type OrderItem from "#models/order_item";
import { OrderItemExtendValidator } from "#services/orders/validation/order_item_extend_validator";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { Branch } from "#shared/branch";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import { branchDto } from "#tests/branch_fixtures";
import { mock } from "#tests/test-doubles";

test.group("OrderItemExtendValidator", (group) => {
  const orderItemExtendValidator = new OrderItemExtendValidator();

  let testOrderItem: OrderItem;

  let testBranch: Branch;
  let testCustomerItem: CustomerItem;
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox.stub(StorageService.CustomerItems, "get").callsFake((id) => {
      if (id !== testCustomerItem.id) {
        return Promise.reject(new BlError("not found").code(702));
      }
      return Promise.resolve(testCustomerItem);
    });

    testCustomerItem = {
      buyout: false,
      cancel: false,
      buyback: false,
      orders: [],
      id: "customerItem1",
      item: "item1",
      type: "rent",
      deadline: new Date(),
      handout: true,
      customer: "customer1",
      handoutInfo: {
        handoutById: "branch1",
        handoutEmployee: "employee1",
        time: new Date(),
      },
      returned: false,
      periodExtends: [
        {
          from: new Date(),
          to: new Date(),
          periodType: "year",
          time: new Date(),
        },
      ],
    };

    testOrderItem = mock<OrderItem>({
      handout: false,
      delivered: false,
      itemId: "item1",
      amount: 100,
      unitPrice: 100,
      type: "extend",
      periodFrom: DateTime.now(),
      periodTo: DateTime.now(),
      numberOfPeriods: 1,
      periodType: "semester",
      customerItemId: "customerItem1",
    });

    testBranch = branchDto({
      id: "branch1",
      type: "privatist",
      name: "Sonans",
      rentPeriods: [{ type: "semester", maxNumberOfPeriods: 2, date: new Date(), percentage: 0.5 }],
      extendPeriods: [
        { type: "semester", maxNumberOfPeriods: 1, date: new Date(), price: 100, percentage: null },
      ],
      buyoutPercentage: 0.5,
      region: "unknown",
    });
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test('should reject if orderItem.type is not "extend"', async ({ assert }) => {
    testOrderItem.type = "rent";
    return assert.rejects(
      () => orderItemExtendValidator.validate(testBranch, testOrderItem),
      BlError,
      /orderItem.type "rent" is not "extend"/,
    );
  });

  test("should reject if orderItem.periodType is not allowed at branch", async ({ assert }) => {
    testOrderItem.periodType = "year";

    testBranch.extendPeriods = [
      { type: "semester", price: 100, date: new Date(), maxNumberOfPeriods: 1, percentage: null },
    ];

    return assert.rejects(
      () => orderItemExtendValidator.validate(testBranch, testOrderItem),
      BlError,
      /orderItem.periodType is "year" but it is not allowed by branch/,
    );
  });

  test("should reject if orderItem.customerItem is not defined", async ({ assert }) => {
    testOrderItem.customerItemId = null;

    return assert.rejects(
      () => orderItemExtendValidator.validate(testBranch, testOrderItem),
      BlError,
      /orderItem.customerItemId is not defined/,
    );
  });

  test("should reject when customerItem have been extended to many times", async ({ assert }) => {
    testCustomerItem.id = "maxExtendedCustomerItem";

    testBranch.extendPeriods = [
      { type: "semester", price: 100, date: new Date(), maxNumberOfPeriods: 1, percentage: null },
    ];

    testCustomerItem.periodExtends = [
      {
        from: new Date(),
        to: new Date(),
        periodType: "semester",
        time: new Date(),
      },
      {
        from: new Date(),
        to: new Date(),
        periodType: "semester",
        time: new Date(),
      },
    ];
    testOrderItem.customerItemId = "maxExtendedCustomerItem";

    return assert.rejects(
      () => orderItemExtendValidator.validate(testBranch, testOrderItem),
      BlError,
      /orderItem can not be extended any more times/,
    );
  });
});
