import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";

import CustomerItem from "#models/customer_item";
import { createBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createUser } from "#tests/user_fixtures";

async function world() {
  const [branch, item, customer] = await Promise.all([createBranch(), createItem(), createUser()]);
  const copy = (overrides: Partial<Parameters<typeof createCustomerItem>[0]> = {}) =>
    createCustomerItem({
      itemId: item.id,
      customerId: customer.id,
      handoutBranchId: branch.id,
      ...overrides,
    });
  return { branch, item, customer, copy };
}

test.group("CustomerItem model", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("active means not returned, bought out, cancelled or bought back", async ({ assert }) => {
    const { customer, copy } = await world();
    const held = await copy({ blid: "held0001", deadline: DateTime.fromISO("2027-01-01") });
    const heldLonger = await copy({ deadline: DateTime.fromISO("2027-07-01") });
    await copy({ blid: "held0001", returned: true });
    await copy({ buyout: true });
    await copy({ returned: true, cancel: true });
    await copy({ returned: true, buyback: true });

    assert.deepEqual(
      (await CustomerItem.activeFor(customer.id)).map((customerItem) => customerItem.id),
      [held.id, heldLonger.id],
    );
    assert.deepEqual(
      (await CustomerItem.activeByBlid("held0001")).map((customerItem) => customerItem.id),
      [held.id],
    );
    assert.isTrue(await CustomerItem.hasActive(customer.id));
    assert.isFalse(await CustomerItem.hasActive((await createUser()).id));
  });

  test("one active loan per blid, while returned loans of it pile up", async ({ assert }) => {
    const { copy } = await world();
    await copy({ blid: "blid0001", returned: true });
    await copy({ blid: "blid0001", returned: true });
    await copy({ blid: "blid0001" });

    await assert.rejects(() => copy({ blid: "blid0001" }), /customer_items_unique_active_blid/);
  });

  test("reads its extensions oldest first", async ({ assert }) => {
    const { copy } = await world();
    const extended = await copy({
      periodExtends: [
        {
          periodFrom: DateTime.fromISO("2027-01-01"),
          periodTo: DateTime.fromISO("2027-07-01"),
          createdAt: DateTime.fromISO("2026-12-01"),
        },
        {
          periodFrom: DateTime.fromISO("2026-07-01"),
          periodTo: DateTime.fromISO("2027-01-01"),
          createdAt: DateTime.fromISO("2026-06-01"),
        },
      ],
    });

    assert.deepEqual(
      extended.periodExtends.map((periodExtend) => periodExtend.periodTo.toISODate()),
      ["2027-01-01", "2027-07-01"],
    );
    assert.deepEqual(
      extended.toDto().periodExtends.map((periodExtend) => periodExtend.periodType),
      ["semester", "semester"],
    );
  });

  test("the orders behind a customer item are the lines naming it, oldest order first", async ({
    assert,
  }) => {
    const { branch, item, customer, copy } = await world();
    const book = await copy();
    const other = await copy();
    const line = (overrides: object) => ({
      itemId: item.id,
      customerItemId: book.id,
      ...overrides,
    });
    const handout = await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      createdAt: DateTime.fromISO("2026-08-01"),
      orderItems: [
        line({ type: "rent", periodType: "year" }),
        line({ type: "rent", periodType: "year", customerItemId: other.id }),
      ],
    });
    const extension = await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      createdAt: DateTime.fromISO("2026-12-01"),
      orderItems: [line({ type: "extend", periodType: "semester" })],
    });
    const invoicePaid = await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      createdAt: DateTime.fromISO("2027-02-01"),
      orderItems: [line({ type: "invoice-paid" })],
    });

    const orderIds = await CustomerItem.orderIdsOf([book.id, other.id]);
    assert.deepEqual(orderIds.get(book.id), [handout.id, extension.id, invoicePaid.id]);
    assert.deepEqual(orderIds.get(other.id), [handout.id]);
    assert.deepEqual(await CustomerItem.orderIdsOf([]), new Map());

    // The invoice payment is newer but did not set the period.
    const last = await CustomerItem.lastPeriodLinesOf([book.id, other.id]);
    assert.deepEqual(last.get(book.id), { orderId: extension.id, periodType: "semester" });
    assert.deepEqual(last.get(other.id), { orderId: handout.id, periodType: "year" });
  });
});
