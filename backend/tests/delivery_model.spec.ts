import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";

import Delivery from "#models/delivery";
import { createBranch } from "#tests/branch_fixtures";
import { createDelivery } from "#tests/delivery_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createUser } from "#tests/user_fixtures";

async function world() {
  const [branch, item, customer] = await Promise.all([createBranch(), createItem(), createUser()]);
  const order = () =>
    createOrder({
      branchId: branch.id,
      customerId: customer.id,
      orderItems: [{ itemId: item.id }],
    });
  return { branch, order };
}

test.group("Delivery model", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("finds the delivery of each order, and which orders went by Bring", async ({ assert }) => {
    const { branch, order } = await world();
    const [mailed, pickedUp, plain] = [await order(), await order(), await order()];
    const shipment = await createDelivery({ orderId: mailed.id });
    await createDelivery({ orderId: pickedUp.id, method: "branch", branchId: branch.id });

    assert.equal((await Delivery.ofOrder(mailed.id))?.id, shipment.id);
    assert.isNull(await Delivery.ofOrder(plain.id));
    assert.sameMembers(
      [...(await Delivery.byOrderIds([mailed.id, pickedUp.id, plain.id])).keys()],
      [mailed.id, pickedUp.id],
    );
    assert.deepEqual(
      [...(await Delivery.bringOrderIds([mailed.id, pickedUp.id, plain.id]))],
      [mailed.id],
    );
    assert.equal((await Delivery.bringOrderIds([])).size, 0);
  });

  test("the delivery goes with its order", async ({ assert }) => {
    const { order } = await world();
    const mailed = await order();
    const shipment = await createDelivery({ orderId: mailed.id });

    await mailed.delete();
    assert.isNull(await Delivery.find(shipment.id));
  });

  test("an order has one delivery, a pickup names its branch, a shipment its addresses", async ({
    assert,
  }) => {
    const { branch, order } = await world();
    const mailed = await order();
    await createDelivery({ orderId: mailed.id });

    await assert.rejects(() => createDelivery({ orderId: mailed.id }), /unique/);
    await assert.rejects(
      () => createDelivery({ orderId: mailed.id, branchId: branch.id }),
      /deliveries_branch_matches_method/,
    );
    await assert.rejects(
      async () => createDelivery({ orderId: (await order()).id, method: "branch" }),
      /deliveries_branch_matches_method/,
    );
    await assert.rejects(
      async () => createDelivery({ orderId: (await order()).id, shipmentAddress: null }),
      /deliveries_bring_complete/,
    );
  });
});
