import { test } from "@japa/runner";

import type { SummaryRow } from "#services/branch_books_service";
import { buildSummary, clusterDeadlines } from "#services/branch_books_service";

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
