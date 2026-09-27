import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";

import Payment from "#models/payment";
import { createBranch } from "#tests/branch_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createPayment } from "#tests/payment_fixtures";
import { createUser } from "#tests/user_fixtures";

async function world() {
  const [branch, item, customer] = await Promise.all([createBranch(), createItem(), createUser()]);
  return () =>
    createOrder({
      branchId: branch.id,
      customerId: customer.id,
      orderItems: [{ itemId: item.id }],
    });
}

test.group("Payment model", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("lists an order's payments in the order they were recorded", async ({ assert }) => {
    const order = await world();
    const [paid, refunded, plain] = [await order(), await order(), await order()];
    const later = await createPayment({
      orderId: paid.id,
      method: "cash",
      createdAt: DateTime.fromISO("2026-08-16T10:00:00Z"),
    });
    const earlier = await createPayment({
      orderId: paid.id,
      createdAt: DateTime.fromISO("2026-08-15T10:00:00Z"),
    });
    await createPayment({ orderId: refunded.id, method: "vipps-epayment", amount: -100 });

    assert.deepEqual(
      (await Payment.ofOrder(paid.id)).map((payment) => payment.id),
      [earlier.id, later.id],
    );
    const byOrder = await Payment.byOrderIds([paid.id, refunded.id, plain.id]);
    assert.sameMembers([...byOrder.keys()], [paid.id, refunded.id]);
    assert.deepEqual(
      byOrder.get(paid.id)?.map((payment) => payment.id),
      [earlier.id, later.id],
    );
    assert.equal((await Payment.byOrderIds([])).size, 0);
    assert.isTrue(await Payment.existFor(refunded.id));
    assert.isFalse(await Payment.existFor(plain.id));
  });

  test("the payments go with their order", async ({ assert }) => {
    const order = await world();
    const paid = await order();
    const payment = await createPayment({ orderId: paid.id });

    await paid.delete();
    assert.isNull(await Payment.find(payment.id));
  });
});
