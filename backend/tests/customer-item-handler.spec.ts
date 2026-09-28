import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";

import CustomerItem from "#models/customer_item";
import type OrderItem from "#models/order_item";
import { CustomerItemHandler } from "#services/customer_items/customer_item_handler";
import { BlError } from "#shared/bl-error";
import { createBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { createItem } from "#tests/item_fixtures";
import { mock } from "#tests/test-doubles";
import { createUser } from "#tests/user_fixtures";

async function heldBook(overrides: Partial<Pick<CustomerItem, "returned">> = {}) {
  const [branch, item, customer] = await Promise.all([
    createBranch({
      extendPeriods: [
        {
          type: "semester",
          date: "2028-01-01",
          maxNumberOfPeriods: 1,
          price: 100,
          percentage: null,
        },
      ],
    }),
    createItem(),
    createUser(),
  ]);
  const customerItem = await createCustomerItem({
    itemId: item.id,
    customerId: customer.id,
    handoutBranchId: branch.id,
    deadline: DateTime.fromISO("2027-07-01"),
    ...overrides,
  });
  return { branch, customer, customerItem };
}

test.group("CustomerItemHandler", (group) => {
  const customerItemHandler = new CustomerItemHandler();

  group.each.setup(() => testUtils.db().truncate());

  test("should reject if returned is true", async ({ assert }) => {
    const { branch, customerItem } = await heldBook({ returned: true });

    await assert.rejects(
      () => customerItemHandler.extend(customerItem.id, mock<OrderItem>({}), branch.id),
      BlError,
      /can not extend when returned is true/,
    );
  });

  test("should reject if orderItem.type is not extend", async ({ assert }) => {
    const { branch, customerItem } = await heldBook();

    await assert.rejects(
      () =>
        customerItemHandler.extend(customerItem.id, mock<OrderItem>({ type: "rent" }), branch.id),
      BlError,
      /orderItem.type is not "extend"/,
    );
  });

  test("should reject if branch does not have the extend period", async ({ assert }) => {
    const { branch, customerItem } = await heldBook();
    const orderItem = mock<OrderItem>({
      type: "extend",
      periodFrom: DateTime.now(),
      periodTo: DateTime.now(),
      numberOfPeriods: 1,
      periodType: "year",
      customerItemId: customerItem.id,
    });

    await assert.rejects(
      () => customerItemHandler.extend(customerItem.id, orderItem, branch.id),
      BlError,
      /extend period "year" is not present on branch/,
    );
  });

  test("records the extension and moves the deadline", async ({ assert }) => {
    const { branch, customerItem } = await heldBook();
    const orderItem = mock<OrderItem>({
      type: "extend",
      periodFrom: DateTime.fromISO("2026-09-01"),
      periodTo: DateTime.fromISO("2028-01-01"),
      numberOfPeriods: 1,
      periodType: "semester",
      customerItemId: customerItem.id,
    });

    await customerItemHandler.extend(customerItem.id, orderItem, branch.id);

    const extended = await CustomerItem.findOrFail(customerItem.id);
    assert.equal(extended.deadline.toISODate(), "2028-01-01");
    assert.deepEqual(
      extended.periodExtends.map((periodExtend) => [
        periodExtend.periodFrom.toISODate(),
        periodExtend.periodTo.toISODate(),
        periodExtend.periodType,
      ]),
      [["2026-09-01", "2028-01-01", "semester"]],
    );
  });

  test("records the return with branch and employee", async ({ assert }) => {
    const { branch, customerItem } = await heldBook();
    const employee = await createUser({ permission: "employee" });

    await customerItemHandler.return(
      customerItem.id,
      mock<OrderItem>({ type: "return" }),
      branch.id,
      employee.id,
    );

    const returned = await CustomerItem.findOrFail(customerItem.id);
    assert.isTrue(returned.returned);
    assert.equal(returned.returnBranchId, branch.id);
    assert.equal(returned.returnEmployeeId, employee.id);
    assert.isNotNull(returned.returnedAt);
  });

  test('should reject if orderItem.type is not "buyout"', async ({ assert }) => {
    const orderItem = mock<OrderItem>({
      type: "rent",
    });
    await assert.rejects(
      () => customerItemHandler.buyout("customerItem1", "order1", orderItem),
      BlError,
      /orderItem.type is not "buyout"/,
    );
  });

  test('should reject if orderItem.type is not "return"', async ({ assert }) => {
    const orderItem = mock<OrderItem>({
      type: "rent",
    });
    await assert.rejects(
      () => customerItemHandler.return("customerItem1", orderItem, "branch1", "employee1"),
      BlError,
      /orderItem.type is not "return"/,
    );
  });

  test('should reject if orderItem.type is not "buyback"', async ({ assert }) => {
    const orderItem = mock<OrderItem>({
      type: "rent",
    });
    await assert.rejects(
      () => customerItemHandler.buyback("customerItem1", "order1", orderItem),
      BlError,
      /orderItem.type is not "buyback"/,
    );
  });
});
