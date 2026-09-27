import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import db from "@adonisjs/lucid/services/db";
import { DateTime } from "luxon";

import { isObjectIdHex } from "#models/helpers/object_id";
import Order from "#models/order";
import { createBranch } from "#tests/branch_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createUser } from "#tests/user_fixtures";

test.group("Order model", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("createWithItems stores the lines in receipt order with an ObjectId-shaped id", async ({
    assert,
  }) => {
    const [branch, customer, sinus, matte] = await Promise.all([
      createBranch(),
      createUser(),
      createItem({ title: "Sinus 1T" }),
      createItem({ title: "Matte 1P" }),
    ]);
    const created = await Order.createWithItems({
      amount: 300,
      branchId: branch.id,
      customerId: customer.id,
      byCustomer: true,
      orderItems: [
        { type: "rent", itemId: matte.id, amount: 100, unitPrice: 100 },
        {
          type: "buy",
          itemId: sinus.id,
          amount: 200,
          unitPrice: 200,
          periodTo: DateTime.fromISO("2027-06-30T00:00:00Z"),
        },
      ],
    });

    assert.isTrue(isObjectIdHex(created.id));
    const order = await Order.getOrFail(created.id);
    assert.deepEqual(
      order.orderItems.map((orderItem) => [orderItem.position, orderItem.title, orderItem.type]),
      [
        [0, "Matte 1P", "rent"],
        [1, "Sinus 1T", "buy"],
      ],
    );
    assert.isTrue(order.notifyByEmail);
    assert.isFalse(order.placed);
    assert.equal(order.toDto().orderItems[1]?.periodTo?.toISOString(), "2027-06-30T00:00:00.000Z");
  });

  test("saveWithItems persists lines changed in place", async ({ assert }) => {
    const [branch, item] = await Promise.all([createBranch(), createItem()]);
    const order = await createOrder({
      branchId: branch.id,
      customerId: null,
      orderItems: [{ itemId: item.id }, { itemId: item.id }],
    });

    order.placed = false;
    const second = order.orderItems[1];
    assert.exists(second);
    second!.handout = true;
    await order.saveWithItems();

    const stored = await Order.getOrFail(order.id);
    assert.isFalse(stored.placed);
    assert.deepEqual(
      stored.orderItems.map((orderItem) => orderItem.handout),
      [false, true],
    );
  });

  test("deleting an order deletes its lines and clears moved references", async ({ assert }) => {
    const [branch, item] = await Promise.all([createBranch(), createItem()]);
    const first = await createOrder({
      branchId: branch.id,
      customerId: null,
      orderItems: [{ itemId: item.id }],
    });
    const second = await createOrder({
      branchId: branch.id,
      customerId: null,
      orderItems: [{ itemId: item.id, movedFromOrderId: first.id }],
    });

    await first.delete();

    const [{ total }] = await db
      .from("order_items")
      .where("order_id", first.id)
      .count("* as total");
    assert.equal(Number(total), 0);
    assert.isNull((await Order.getOrFail(second.id)).orderItems[0]?.movedFromOrderId);
  });

  test("a deleted customer leaves the order behind without a customer", async ({ assert }) => {
    const [branch, customer, item] = await Promise.all([
      createBranch(),
      createUser(),
      createItem(),
    ]);
    const order = await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      orderItems: [{ itemId: item.id }],
    });

    await customer.delete();

    assert.isNull((await Order.getOrFail(order.id)).customerId);
  });

  test("byIds skips missing ids and getOrFail throws a 404", async ({ assert }) => {
    const [branch, item] = await Promise.all([createBranch(), createItem()]);
    const order = await createOrder({
      branchId: branch.id,
      customerId: null,
      orderItems: [{ itemId: item.id }],
    });

    const found = await Order.byIds([order.id, "ffffffffffffffffffffffff", null]);
    assert.deepEqual([...found.keys()], [order.id]);
    await assert.rejects(() => Order.getOrFail("ffffffffffffffffffffffff"), /Fant ikke ordre/);
  });
});
