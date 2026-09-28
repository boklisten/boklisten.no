import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";
import { createSandbox } from "sinon";

import Order from "#models/order";
import type { SummaryRow } from "#services/branch_books_service";
import { BranchBooksService, buildSummary } from "#services/branch_books_service";
import { OrderCancellationService } from "#services/order_cancellation_service";
import { createBranch } from "#tests/branch_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createUser } from "#tests/user_fixtures";

const JULY_1 = "2026-07-01";
const DECEMBER_20 = "2026-12-20";

test.group("BranchBooksService.buildSummary()", () => {
  const rows: SummaryRow[] = [
    { deadline: JULY_1, itemId: "item-b", title: "Sinus 1T", direct: 3, total: 5 },
    { deadline: JULY_1, itemId: "item-a", title: "Aktør", direct: 2, total: 2 },
    { deadline: DECEMBER_20, itemId: "item-b", title: "Sinus 1T", direct: 0, total: 4 },
  ];

  test("groups titles by deadline, oldest first, and computes metrics", ({ assert }) => {
    const summary = buildSummary(rows);
    assert.deepEqual(
      summary.groups.map((group) => group.deadline),
      [JULY_1, DECEMBER_20],
    );
    const [julyGroup] = summary.groups;
    assert.deepEqual(julyGroup?.titles, [
      { itemId: "item-a", title: "Aktør", direct: 2, indirect: 0, total: 2 },
      { itemId: "item-b", title: "Sinus 1T", direct: 3, indirect: 2, total: 5 },
    ]);
    assert.equal(julyGroup?.direct, 5);
    assert.equal(julyGroup?.indirect, 2);
    assert.equal(julyGroup?.total, 7);
  });

  test("computes top-level totals across all groups", ({ assert }) => {
    const summary = buildSummary(rows);
    assert.equal(summary.direct, 5);
    assert.equal(summary.indirect, 6);
    assert.equal(summary.total, 11);
  });

  test("returns an empty summary for no rows", ({ assert }) => {
    assert.deepEqual(buildSummary([]), { direct: 0, indirect: 0, total: 0, groups: [] });
  });
});

/** A branch with a child branch, a customer, two books and a deadline. */
async function seedOrderedBooks() {
  const parent = await createBranch({ name: "Ullern VGS" });
  const child = await createBranch({ name: "Ullern VG1", parentBranchId: parent.id });
  const [customer, sinus, matte] = await Promise.all([
    createUser({ name: "Kari" }),
    createItem({ title: "Sinus 1T" }),
    createItem({ title: "Matte 1P" }),
  ]);
  const deadline = DateTime.fromISO(JULY_1);
  return { parent, child, customer, sinus, matte, deadline };
}

test.group("BranchBooksService: ordered books", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("the summary counts open rent lines with a deadline, direct and via children", async ({
    assert,
  }) => {
    const { parent, child, customer, sinus, matte, deadline } = await seedOrderedBooks();
    await createOrder({
      branchId: parent.id,
      customerId: customer.id,
      orderItems: [
        { itemId: sinus.id, periodTo: deadline },
        { itemId: matte.id, type: "partly-payment", periodTo: deadline },
        // Not ordered books: handed out, a buy, no deadline.
        { itemId: sinus.id, periodTo: deadline, handout: true },
        { itemId: sinus.id, type: "buy", periodTo: deadline },
        { itemId: sinus.id },
      ],
    });
    await createOrder({
      branchId: child.id,
      customerId: customer.id,
      orderItems: [{ itemId: sinus.id, periodTo: deadline }],
    });
    await createOrder({
      branchId: parent.id,
      customerId: customer.id,
      placed: false,
      orderItems: [{ itemId: sinus.id, periodTo: deadline }],
    });

    const summary = await BranchBooksService.getOrderedBooksSummary(parent.id);

    assert.equal(summary.total, 3);
    assert.equal(summary.direct, 2);
    assert.equal(summary.groups[0]?.deadline, JULY_1);
    assert.deepEqual(
      summary.groups[0]?.titles.map((title) => [title.title, title.direct, title.indirect]),
      [
        ["Matte 1P", 1, 0],
        ["Sinus 1T", 1, 1],
      ],
    );
  });

  test("details list the direct lines of one book and deadline, oldest order first", async ({
    assert,
  }) => {
    const { parent, child, customer, sinus, deadline } = await seedOrderedBooks();
    const later = await createOrder({
      branchId: parent.id,
      customerId: null,
      createdAt: DateTime.fromISO("2026-05-02T10:00:00Z"),
      orderItems: [{ itemId: sinus.id, periodTo: deadline }],
    });
    const earlier = await createOrder({
      branchId: parent.id,
      customerId: customer.id,
      createdAt: DateTime.fromISO("2026-05-01T10:00:00Z"),
      orderItems: [{ itemId: sinus.id, periodTo: deadline }],
    });
    await createOrder({
      branchId: child.id,
      customerId: customer.id,
      orderItems: [{ itemId: sinus.id, periodTo: deadline }],
    });

    const details = await BranchBooksService.getOrderedBookDetails({
      branchId: parent.id,
      deadline: JULY_1,
      itemId: sinus.id,
    });

    assert.deepEqual(
      details.map((row) => [row.orderId, row.orderItemId, row.customerName]),
      [
        [earlier.id, earlier.orderItems[0]?.id, "Kari"],
        [later.id, later.orderItems[0]?.id, null],
      ],
    );
    assert.equal(details[0]?.orderTime, "2026-05-01T10:00:00.000Z");
  });

  test("a bulk deadline change moves only the matching open lines", async ({ assert }) => {
    const { parent, child, customer, sinus, matte, deadline } = await seedOrderedBooks();
    const order = await createOrder({
      branchId: parent.id,
      customerId: customer.id,
      orderItems: [
        { itemId: sinus.id, periodTo: deadline },
        { itemId: matte.id, periodTo: deadline },
      ],
    });
    const childOrder = await createOrder({
      branchId: child.id,
      customerId: customer.id,
      orderItems: [{ itemId: sinus.id, periodTo: deadline }],
    });
    const newDeadline = DECEMBER_20;

    const result = await BranchBooksService.bulkUpdateOrderedBooks({
      branchId: parent.id,
      filter: { deadline: JULY_1, itemId: sinus.id, includeDescendants: false },
      update: { deadline: newDeadline },
    });

    assert.deepEqual(result, { matchedCount: 1, modifiedCount: 1 });
    const [sinusLine, matteLine] = (await Order.getOrFail(order.id)).orderItems;
    assert.equal(sinusLine?.periodTo?.toISODate(), newDeadline);
    assert.equal(matteLine?.periodTo?.toISODate(), JULY_1);
    const [childLine] = (await Order.getOrFail(childOrder.id)).orderItems;
    assert.equal(childLine?.periodTo?.toISODate(), JULY_1);
  });

  test("a bulk branch change moves the orders of the addressed lines", async ({ assert }) => {
    const { parent, child, customer, sinus, deadline } = await seedOrderedBooks();
    const other = await createBranch({ name: "Nydalen VGS" });
    const order = await createOrder({
      branchId: parent.id,
      customerId: customer.id,
      orderItems: [{ itemId: sinus.id, periodTo: deadline }],
    });
    const childOrder = await createOrder({
      branchId: child.id,
      customerId: customer.id,
      orderItems: [{ itemId: sinus.id, periodTo: deadline }],
    });

    const result = await BranchBooksService.bulkUpdateOrderedBooks({
      branchId: parent.id,
      filter: {
        orderItemIds: [order.orderItems[0]?.id ?? 0, childOrder.orderItems[0]?.id ?? 0],
        includeDescendants: true,
      },
      update: { branchId: other.id },
    });

    assert.deepEqual(result, { matchedCount: 2, modifiedCount: 2 });
    assert.equal((await Order.getOrFail(order.id)).branchId, other.id);
    assert.equal((await Order.getOrFail(childOrder.id)).branchId, other.id);
  });

  test("a bulk cancel cancels free orders and skips orders with money on them", async ({
    assert,
  }) => {
    const { parent, customer, sinus, matte, deadline } = await seedOrderedBooks();
    const free = await createOrder({
      branchId: parent.id,
      customerId: customer.id,
      orderItems: [
        { itemId: sinus.id, periodTo: deadline },
        { itemId: matte.id, periodTo: deadline },
      ],
    });
    await createOrder({
      branchId: parent.id,
      customerId: customer.id,
      amount: 100,
      orderItems: [{ itemId: sinus.id, periodTo: deadline }],
    });
    const sandbox = createSandbox();
    const cancel = sandbox.stub(OrderCancellationService, "cancelOrderItems").resolves();
    try {
      const result = await BranchBooksService.bulkCancelOrderedBooks({
        branchId: parent.id,
        filter: { deadline: JULY_1, includeDescendants: false },
        notifyCustomers: false,
        employeeId: customer.id,
      });

      assert.deepEqual(result, { cancelledOrders: 1, cancelledBooks: 2, skippedBooks: 1 });
      assert.isTrue(cancel.calledOnce);
      const [call] = cancel.firstCall.args;
      assert.equal(call.originalOrder.id, free.id);
      assert.deepEqual(call.orderItems, [{ itemId: sinus.id }, { itemId: matte.id }]);
    } finally {
      sandbox.restore();
    }
  });
});
