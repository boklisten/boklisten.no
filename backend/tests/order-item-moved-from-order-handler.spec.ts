import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";

import type Branch from "#models/branch";
import Order from "#models/order";
import type User from "#models/user";
import { OrderItemMovedFromOrderHandler } from "#services/orders/order_item_moved_from_order_handler";
import { BlError } from "#shared/bl-error";
import { createBranch } from "#tests/branch_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createUser } from "#tests/user_fixtures";

/** The two GYMNOS editions customers order interchangeably. */
const GYMNOS_2009 = "5b6441c4d2e733002fae89a6";
const GYMNOS_2012 = "5b6441b2d2e733002fae87a6";
const OTHER_ITEM = "5b6441b2d2e733002fae0000";

/** The original order's lines as stored after the handler ran. */
async function storedMovedToOrderIds(orderId: string) {
  const order = await Order.getOrFail(orderId);
  return order.orderItems.map((orderItem) => orderItem.movedToOrderId);
}

test.group("OrderItemMovedFromOrderHandler", (group) => {
  const oiMovedFromOrderHandler = new OrderItemMovedFromOrderHandler();
  let branch: Branch;
  let customer: User;

  group.each.setup(async () => {
    const truncate = await testUtils.db().truncate();
    [branch, customer] = await Promise.all([
      createBranch(),
      createUser(),
      createItem({ id: GYMNOS_2009 }),
      createItem({ id: GYMNOS_2012 }),
      createItem({ id: OTHER_ITEM }),
    ]);
    return truncate;
  });

  /** A placed order with one free rent line per item. */
  function orderWithItems(itemIds: string[], movedFromOrderId: string | null = null) {
    return createOrder({
      branchId: branch.id,
      customerId: customer.id,
      orderItems: itemIds.map((itemId) => ({ itemId, movedFromOrderId })),
    });
  }

  test('should reject if original order item already have "movedToOrder"', async ({ assert }) => {
    const anotherOrder = await orderWithItems([GYMNOS_2009]);
    const originalOrder = await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      orderItems: [{ itemId: GYMNOS_2009, movedToOrderId: anotherOrder.id }],
    });
    const order = await orderWithItems([GYMNOS_2009], originalOrder.id);

    return assert.rejects(
      () => oiMovedFromOrderHandler.updateOrderItems(order),
      BlError,
      /orderItem has "movedToOrder" already set/,
    );
  });

  test('marks an equivalent edition\'s order item with "movedToOrder"', async ({ assert }) => {
    // The customer ordered GYMNOS 2009 but received a GYMNOS 2012 copy.
    const originalOrder = await orderWithItems([GYMNOS_2009]);
    const newOrder = await orderWithItems([GYMNOS_2012], originalOrder.id);

    await oiMovedFromOrderHandler.updateOrderItems(newOrder);

    assert.deepEqual(await storedMovedToOrderIds(originalOrder.id), [newOrder.id]);
  });

  test("prefers the exact item over an equivalent edition", async ({ assert }) => {
    const originalOrder = await orderWithItems([GYMNOS_2009, GYMNOS_2012]);
    const newOrder = await orderWithItems([GYMNOS_2012], originalOrder.id);

    await oiMovedFromOrderHandler.updateOrderItems(newOrder);

    assert.deepEqual(await storedMovedToOrderIds(originalOrder.id), [null, newOrder.id]);
  });

  test("leaves an unrelated item untouched", async ({ assert }) => {
    const originalOrder = await orderWithItems([OTHER_ITEM]);
    const newOrder = await orderWithItems([GYMNOS_2012], originalOrder.id);

    await oiMovedFromOrderHandler.updateOrderItems(newOrder);

    assert.deepEqual(await storedMovedToOrderIds(originalOrder.id), [null]);
  });
});
