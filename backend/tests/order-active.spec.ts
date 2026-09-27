import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";

import type Branch from "#models/branch";
import type Item from "#models/item";
import type User from "#models/user";
import { OrderActive } from "#services/orders/order_active";
import { createBranch } from "#tests/branch_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createUser } from "#tests/user_fixtures";

test.group("OrderActive", (group) => {
  const orderActive = new OrderActive();
  let branch: Branch;
  let customer: User;
  let item: Item;

  group.each.setup(async () => {
    const truncate = await testUtils.db().truncate();
    [branch, customer, item] = await Promise.all([createBranch(), createUser(), createItem()]);
    return truncate;
  });

  test("should resolve with false if no orders was found", async ({ assert }) => {
    assert.isFalse(await orderActive.haveActiveOrders(customer.id));
  });

  test("should resolve with false if orders was found but none was active", async ({ assert }) => {
    await createOrder({ branchId: branch.id, customerId: customer.id, placed: false });

    assert.isFalse(await orderActive.haveActiveOrders(customer.id));
  });

  test("should resolve with true if orders was found and at least one was active", async ({
    assert,
  }) => {
    await createOrder({ branchId: branch.id, customerId: customer.id, placed: false });
    await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      amount: 100,
      orderItems: [{ type: "partly-payment", itemId: item.id, amount: 100, unitPrice: 100 }],
    });

    assert.isTrue(await orderActive.haveActiveOrders(customer.id));
  });

  test("should resolve with false if orders was found and all order-items was handed out", async ({
    assert,
  }) => {
    for (let index = 0; index < 2; index++) {
      await createOrder({
        branchId: branch.id,
        customerId: customer.id,
        amount: 100,
        orderItems: [
          { type: "partly-payment", itemId: item.id, amount: 100, unitPrice: 100, handout: true },
        ],
      });
    }

    assert.isFalse(await orderActive.haveActiveOrders(customer.id));
  });
});
