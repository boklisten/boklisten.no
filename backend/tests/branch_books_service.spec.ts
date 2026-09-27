import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";
import { createSandbox } from "sinon";

import Order from "#models/order";
import type { SummaryRow } from "#services/branch_books_service";
import { BranchBooksService, buildSummary, clusterDeadlines } from "#services/branch_books_service";
import { OrderCancellationService } from "#services/order_cancellation_service";
import { createBranch } from "#tests/branch_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createUser } from "#tests/user_fixtures";

const JULY_1 = new Date("2026-07-01T00:00:00.000Z");
const JUNE_30 = new Date("2026-06-30T22:00:00.000Z");
const DECEMBER_20 = new Date("2026-12-20T00:00:00.000Z");

test.group("BranchBooksService.clusterDeadlines()", () => {
  test("groups deadlines within the padding window into one cluster", ({ assert }) => {
    const clusters = clusterDeadlines([
      { deadline: JULY_1, count: 100 },
      { deadline: JUNE_30, count: 5 },
      { deadline: DECEMBER_20, count: 50 },
    ]);
    assert.lengthOf(clusters, 2);
    assert.deepEqual(clusters[0]?.members, [JUNE_30, JULY_1]);
    assert.deepEqual(clusters[1]?.members, [DECEMBER_20]);
  });

  test("uses the most common deadline as the cluster anchor", ({ assert }) => {
    const clusters = clusterDeadlines([
      { deadline: JUNE_30, count: 5 },
      { deadline: JULY_1, count: 100 },
    ]);
    assert.deepEqual(clusters[0]?.anchor, JULY_1);
  });

  test("sorts clusters by anchor from oldest to newest", ({ assert }) => {
    const clusters = clusterDeadlines([
      { deadline: DECEMBER_20, count: 100 },
      { deadline: JULY_1, count: 5 },
    ]);
    assert.deepEqual(
      clusters.map((cluster) => cluster.anchor),
      [JULY_1, DECEMBER_20],
    );
  });

  test("merges counts for duplicate deadlines before picking anchors", ({ assert }) => {
    const clusters = clusterDeadlines([
      { deadline: JUNE_30, count: 40 },
      { deadline: JUNE_30, count: 40 },
      { deadline: JULY_1, count: 50 },
    ]);
    assert.lengthOf(clusters, 1);
    assert.deepEqual(clusters[0]?.anchor, JUNE_30);
  });

  test("does not chain deadlines beyond the padding window", ({ assert }) => {
    const clusters = clusterDeadlines([
      { deadline: new Date("2026-07-01T00:00:00.000Z"), count: 100 },
      { deadline: new Date("2026-07-02T00:00:00.000Z"), count: 10 },
      { deadline: new Date("2026-07-04T00:00:00.000Z"), count: 10 },
    ]);
    assert.lengthOf(clusters, 2);
    assert.deepEqual(clusters[0]?.members, [
      new Date("2026-07-01T00:00:00.000Z"),
      new Date("2026-07-02T00:00:00.000Z"),
    ]);
    assert.deepEqual(clusters[1]?.members, [new Date("2026-07-04T00:00:00.000Z")]);
  });
});

test.group("BranchBooksService.buildSummary()", () => {
  const rows: SummaryRow[] = [
    { deadline: JULY_1, itemId: "item-b", title: "Sinus 1T", direct: 3, total: 5 },
    { deadline: JUNE_30, itemId: "item-b", title: "Sinus 1T", direct: 1, total: 1 },
    { deadline: JULY_1, itemId: "item-a", title: "Aktør", direct: 2, total: 2 },
    { deadline: DECEMBER_20, itemId: "item-b", title: "Sinus 1T", direct: 0, total: 4 },
  ];

  test("merges titles across clustered deadlines and computes metrics", ({ assert }) => {
    const summary = buildSummary(rows);
    assert.lengthOf(summary.groups, 2);
    const [julyGroup] = summary.groups;
    assert.equal(julyGroup?.deadline, JULY_1.toISOString());
    assert.deepEqual(julyGroup?.deadlines, [JUNE_30.toISOString(), JULY_1.toISOString()]);
    assert.deepEqual(julyGroup?.titles, [
      { itemId: "item-a", title: "Aktør", direct: 2, indirect: 0, total: 2 },
      { itemId: "item-b", title: "Sinus 1T", direct: 4, indirect: 2, total: 6 },
    ]);
    assert.equal(julyGroup?.direct, 6);
    assert.equal(julyGroup?.indirect, 2);
    assert.equal(julyGroup?.total, 8);
  });

  test("computes top-level totals across all groups", ({ assert }) => {
    const summary = buildSummary(rows);
    assert.equal(summary.direct, 6);
    assert.equal(summary.indirect, 6);
    assert.equal(summary.total, 12);
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
  const deadline = DateTime.fromJSDate(JULY_1);
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
    assert.deepEqual(summary.groups[0]?.deadlines, [JULY_1.toISOString()]);
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
      deadlines: [JULY_1.toISOString()],
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
    const newDeadline = "2026-12-20T00:00:00.000Z";

    const result = await BranchBooksService.bulkUpdateOrderedBooks({
      branchId: parent.id,
      filter: { deadlines: [JULY_1.toISOString()], itemId: sinus.id, includeDescendants: false },
      update: { deadline: newDeadline },
    });

    assert.deepEqual(result, { matchedCount: 1, modifiedCount: 1 });
    const [sinusLine, matteLine] = (await Order.getOrFail(order.id)).orderItems;
    assert.equal(sinusLine?.periodTo?.toJSDate().toISOString(), newDeadline);
    assert.equal(matteLine?.periodTo?.toJSDate().toISOString(), JULY_1.toISOString());
    const [childLine] = (await Order.getOrFail(childOrder.id)).orderItems;
    assert.equal(childLine?.periodTo?.toJSDate().toISOString(), JULY_1.toISOString());
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
        filter: { deadlines: [JULY_1.toISOString()], includeDescendants: false },
        notifyCustomers: false,
        employeeDetailsId: customer.id,
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
