import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";

import type { MatchItemRow, MovementRow } from "#services/branch_insights_service";
import {
  buildBookMovements,
  countMovementRows,
  countTransfersPerYear,
  findMatchItemRows,
} from "#services/branch_insights_service";
import { createBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";

const T0 = new Date("2025-08-20T10:00:00.000Z");
const seconds = (n: number) => new Date(T0.getTime() + n * 1000);

function receive(blid: string | null, time: Date, year = 2025): MatchItemRow {
  return { type: "match-receive", blid, time, year };
}
function deliver(blid: string | null, time: Date, year = 2025): MatchItemRow {
  return { type: "match-deliver", blid, time, year };
}

test.group("BranchInsightsService.countTransfersPerYear()", () => {
  test("counts a legacy deliver/receive pair as one transfer", ({ assert }) => {
    const perYear = countTransfersPerYear(
      [deliver("11111111", T0), receive("11111111", seconds(1))],
      [],
    );
    assert.deepEqual([...perYear], [[2025, 1]]);
  });

  test("counts a deliver with no receive in the window", ({ assert }) => {
    const perYear = countTransfersPerYear(
      [deliver("11111111", T0), receive("11111111", seconds(600))],
      [],
    );
    assert.deepEqual([...perYear], [[2025, 2]]);
  });

  test("does not count a deliver whose receive belongs to another branch", ({ assert }) => {
    const perYear = countTransfersPerYear(
      [deliver("11111111", T0)],
      [receive("11111111", seconds(2))],
    );
    assert.deepEqual([...perYear], []);
  });

  test("counts every receive, including a double scan", ({ assert }) => {
    const perYear = countTransfersPerYear(
      [receive("11111111", T0), receive("11111111", seconds(5)), deliver("11111111", seconds(1))],
      [],
    );
    assert.deepEqual([...perYear], [[2025, 2]]);
  });

  test("a deliver without a blid cannot be paired and counts once", ({ assert }) => {
    const perYear = countTransfersPerYear([deliver(null, T0)], [receive(null, seconds(1))]);
    assert.deepEqual([...perYear], [[2025, 1]]);
  });

  test("buckets by the row's year", ({ assert }) => {
    const perYear = countTransfersPerYear(
      [receive("1", T0, 2024), receive("2", T0, 2025), receive("3", T0, 2025)],
      [],
    );
    assert.deepEqual(
      new Map(perYear),
      new Map([
        [2024, 1],
        [2025, 2],
      ]),
    );
  });
});

const row = (partial: Partial<MovementRow> & Pick<MovementRow, "type">): MovementRow => ({
  year: 2025,
  handout: true,
  linked: true,
  count: 1,
  ...partial,
});

test.group("BranchInsightsService.buildBookMovements()", () => {
  test("sums handouts of every kind and skips items never handed out", ({ assert }) => {
    const result = buildBookMovements(
      [
        row({ type: "rent", count: 10 }),
        row({ type: "partly-payment", count: 4 }),
        row({ type: "buy", count: 3 }),
        row({ type: "rent", count: 100, handout: false }),
      ],
      [],
      new Map(),
    );
    assert.deepEqual(result.years, [
      { year: 2025, handedOut: 17, collected: 0, transferred: 0, boughtOut: 0 },
    ]);
  });

  test("counts returns, buybacks and cancelled handouts as collected", ({ assert }) => {
    const result = buildBookMovements(
      [
        row({ type: "return", count: 7, handout: false }),
        row({ type: "return", count: 3 }),
        row({ type: "buyback", count: 20 }),
        row({ type: "cancel", count: 2 }),
        // A cancelled online order that was never handed out moves no book.
        row({ type: "cancel", count: 50, linked: false }),
      ],
      [],
      new Map(),
    );
    assert.deepEqual(result.years[0]?.collected, 32);
  });

  test("counts buyouts and invoiced books as bought out", ({ assert }) => {
    const result = buildBookMovements(
      [row({ type: "buyout", count: 5, handout: false })],
      [{ year: 2025, count: 40 }],
      new Map(),
    );
    assert.deepEqual(result.years[0]?.boughtOut, 45);
  });

  test("fills the gap years with zeros and sorts oldest first", ({ assert }) => {
    const result = buildBookMovements(
      [row({ type: "rent", year: 2026 })],
      [{ year: 2024, count: 3 }],
      new Map([[2023, 2]]),
    );
    assert.deepEqual(
      result.years.map((year) => [year.year, year.handedOut, year.transferred, year.boughtOut]),
      [
        [2023, 0, 2, 0],
        [2024, 0, 0, 3],
        [2025, 0, 0, 0],
        [2026, 1, 0, 0],
      ],
    );
  });

  test("returns no years when nothing happened", ({ assert }) => {
    assert.deepEqual(buildBookMovements([], [], new Map()), { years: [] });
  });
});

test.group("BranchInsightsService: SQL rows", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("counts movement lines per Oslo year, kind, handout and customer-item link", async ({
    assert,
  }) => {
    const [branch, otherBranch, item] = await Promise.all([
      createBranch(),
      createBranch(),
      createItem(),
    ]);
    const cancelled = await createCustomerItem({
      itemId: item.id,
      customerId: null,
      handoutBranchId: branch.id,
    });
    // New Year's Eve 23:30 UTC is already the next year in Oslo.
    await createOrder({
      branchId: branch.id,
      customerId: null,
      createdAt: DateTime.fromISO("2024-12-31T23:30:00Z"),
      orderItems: [
        { itemId: item.id, handout: true },
        { itemId: item.id, handout: true },
        { itemId: item.id, type: "cancel", customerItemId: cancelled.id },
        { itemId: item.id, type: "extend" },
      ],
    });
    await createOrder({
      branchId: branch.id,
      customerId: null,
      placed: false,
      orderItems: [{ itemId: item.id, handout: true }],
    });
    await createOrder({
      branchId: otherBranch.id,
      customerId: null,
      orderItems: [{ itemId: item.id, handout: true }],
    });

    const rows = await countMovementRows([branch.id]);

    assert.sameDeepMembers(rows, [
      { year: 2025, type: "rent", handout: true, linked: false, count: 2 },
      { year: 2025, type: "cancel", handout: false, linked: true, count: 1 },
    ]);
  });

  test("finds match lines inside or outside the branches, by type and blid", async ({ assert }) => {
    const [branch, otherBranch, item] = await Promise.all([
      createBranch(),
      createBranch(),
      createItem(),
    ]);
    const time = DateTime.fromISO("2025-08-20T10:00:00Z");
    await createOrder({
      branchId: branch.id,
      customerId: null,
      createdAt: time,
      orderItems: [
        { itemId: item.id, type: "match-deliver", blid: "11111111" },
        { itemId: item.id, type: "rent", blid: "11111111" },
      ],
    });
    await createOrder({
      branchId: otherBranch.id,
      customerId: null,
      createdAt: time,
      orderItems: [
        { itemId: item.id, type: "match-receive", blid: "11111111" },
        { itemId: item.id, type: "match-receive", blid: "22222222" },
      ],
    });

    const scoped = await findMatchItemRows({ branchIds: [branch.id] });
    assert.deepEqual(scoped, [
      { type: "match-deliver", blid: "11111111", time: time.toJSDate(), year: 2025 },
    ]);

    const external = await findMatchItemRows({
      branchIds: [branch.id],
      outside: true,
      types: ["match-receive"],
      blids: ["11111111"],
    });
    assert.deepEqual(
      external.map((line) => line.blid),
      ["11111111"],
    );
  });
});
