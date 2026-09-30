import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";
import { DateTime } from "luxon";

import CustomerItem from "#models/customer_item";
import type OrderItem from "#models/order_item";
import { OrderItemExtendValidator } from "#services/orders/validation/order_item_extend_validator";
import { BlError } from "#shared/bl-error";
import type { Branch } from "#shared/branch";
import { branchDto } from "#tests/branch_fixtures";
import { customerItemDouble } from "#tests/customer_item_fixtures";
import { mock } from "#tests/test-doubles";

test.group("OrderItemExtendValidator", (group) => {
  const orderItemExtendValidator = new OrderItemExtendValidator();

  let testOrderItem: OrderItem;

  let testBranch: Branch;
  let testCustomerItem: CustomerItem;
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox.stub(CustomerItem, "findOrFail").callsFake((id: unknown) => {
      if (id !== testCustomerItem.id) {
        return Promise.reject(new BlError("not found").code(702));
      }
      return Promise.resolve(testCustomerItem);
    });

    testCustomerItem = customerItemDouble({
      id: "customerItem1",
      itemId: "item1",
      customerId: "customer1",
      handoutBranchId: "branch1",
      handoutEmployeeId: "employee1",
      periodExtends: [{ periodFrom: DateTime.now(), periodTo: DateTime.now(), periodType: "year" }],
    });

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
      name: "Sonans",
      rentPeriods: [
        { type: "semester", maxNumberOfPeriods: 2, date: "2027-07-01", percentage: 0.5 },
      ],
      extendPeriods: [
        {
          type: "semester",
          maxNumberOfPeriods: 1,
          date: "2027-07-01",
          price: 100,
          percentage: null,
        },
      ],
      buyoutPercentage: 0.5,
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
      { type: "semester", price: 100, date: "2027-07-01", maxNumberOfPeriods: 1, percentage: null },
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
    const extension = {
      periodFrom: DateTime.now(),
      periodTo: DateTime.now(),
      periodType: "semester" as const,
    };
    testCustomerItem = customerItemDouble({
      id: "maxExtendedCustomerItem",
      periodExtends: [extension, extension],
    });

    testBranch.extendPeriods = [
      { type: "semester", price: 100, date: "2027-07-01", maxNumberOfPeriods: 1, percentage: null },
    ];

    testOrderItem.customerItemId = "maxExtendedCustomerItem";

    return assert.rejects(
      () => orderItemExtendValidator.validate(testBranch, testOrderItem),
      BlError,
      /orderItem can not be extended any more times/,
    );
  });
});
