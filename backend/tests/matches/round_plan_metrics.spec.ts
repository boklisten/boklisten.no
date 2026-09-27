import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import User from "#models/user";
import { roundPlanMetrics } from "#services/matches/round_plan_metrics";
import { StorageService } from "#services/storage_service";
import { createBranch } from "#tests/branch_fixtures";
import {
  TEST_DEADLINE,
  createTestRound,
  ensureUsers,
  seedTestCatalogue,
} from "#tests/matches/match-testing-utils";
import { createOrder } from "#tests/order_fixtures";
import { unchecked } from "#tests/test-doubles";

const BRANCH = "5d765db5fc8c47001c408b01";
const OTHER_BRANCH = "5d765db5fc8c47001c408b09";
const SENDER = "5d765db5fc8c47001c408b02";
const RECEIVER = "5d765db5fc8c47001c408d81";
const ITEM_X = "5d765db5fc8c47001c408e01";
const ITEM_Y = "5d765db5fc8c47001c408e02";

test.group("roundPlanMetrics", (group) => {
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
  });
  group.each.teardown(() => sandbox.restore());
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(seedTestCatalogue);
  group.each.setup(() => ensureUsers([RECEIVER]));
  group.each.setup(async () => {
    await createBranch({ id: BRANCH });
    await createBranch({ id: OTHER_BRANCH });
  });

  /** The student ordered the books themselves at the branch. */
  const order = (itemIds: string[], overrides: Partial<Parameters<typeof createOrder>[0]> = {}) =>
    createOrder({
      branchId: BRANCH,
      customerId: RECEIVER,
      byCustomer: true,
      orderItems: itemIds.map((itemId) => ({ itemId })),
      ...overrides,
    });

  /** Members and held books aggregate in Mongo to the per-student rows the pipeline groups into. */
  function stubMongo({
    members,
    activeBooks,
  }: {
    members?: { students: number };
    activeBooks?: { id: string; items: string[] }[];
  }) {
    return {
      userDetails: sandbox.stub(User, "countMembersOf").resolves(members?.students ?? 0),
      customerItems: sandbox
        .stub(StorageService.CustomerItems, "aggregate")
        .resolves(activeBooks ?? []),
    };
  }

  test("reports the members, the books out and the books ordered", async ({ assert }) => {
    stubMongo({
      members: { students: 240 },
      activeBooks: [
        { id: "sender-1", items: ["item-1", "item-2"] },
        { id: "sender-2", items: ["item-1"] },
      ],
    });
    await order([ITEM_X, ITEM_Y]);

    const metrics = await roundPlanMetrics(await createTestRound({ branches: [BRANCH] }));

    assert.deepEqual(metrics, {
      branchMembers: 240,
      activeBooks: { books: 3, students: 2 },
      orderedBooks: { books: 2, students: 1 },
    });
  });

  test("reads an empty aggregation as zero rather than nothing", async ({ assert }) => {
    stubMongo({});

    const metrics = await roundPlanMetrics(await createTestRound({ branches: [BRANCH] }));

    assert.deepEqual(metrics, {
      branchMembers: 0,
      activeBooks: { books: 0, students: 0 },
      orderedBooks: { books: 0, students: 0 },
    });
  });

  test("counts the books generation would pick up: the round's branches, its deadline", async ({
    assert,
  }) => {
    const stubs = stubMongo({});

    await roundPlanMetrics(await createTestRound({ branches: [BRANCH] }));

    const [match]: [
      {
        $match: {
          returned: boolean;
          deadline: { $gt: Date; $lt: Date };
          "handoutInfo.handoutById": { $in: { toString: () => string }[] };
        };
      },
    ] = unchecked(stubs.customerItems.firstCall.args[0]);
    assert.isFalse(match.$match.returned, "a returned book is nobody's to hand over");
    assert.equal(
      match.$match.deadline.$gt.toISOString(),
      TEST_DEADLINE.minus({ days: 2 }).toJSDate().toISOString(),
    );
    assert.equal(
      match.$match.deadline.$lt.toISOString(),
      TEST_DEADLINE.plus({ days: 2 }).toJSDate().toISOString(),
    );
    assert.deepEqual(
      match.$match["handoutInfo.handoutById"].$in.map(String),
      [BRANCH],
      "only books handed out at the round's own branches",
    );
    assert.equal(
      stubs.customerItems.callCount,
      1,
      "a branch-only plan never looks beyond its own handouts",
    );
  });

  test("follows the students' other books when the plan includes other branches", async ({
    assert,
  }) => {
    const stubs = stubMongo({});
    stubs.customerItems.onFirstCall().resolves(unchecked([{ id: SENDER, items: ["item-1"] }]));
    stubs.customerItems
      .onSecondCall()
      .resolves(unchecked([{ id: SENDER, items: ["item-1", "item-2"] }]));

    const metrics = await roundPlanMetrics(
      await createTestRound({
        branches: [BRANCH],
        includeCustomerItemsFromOtherBranches: true,
      }),
    );

    const [match]: [
      {
        $match: {
          customer: { $in: { toString: () => string }[] };
          "handoutInfo.handoutById"?: unknown;
        };
      },
    ] = unchecked(stubs.customerItems.secondCall.args[0]);
    assert.deepEqual(
      match.$match.customer.$in.map(String),
      [SENDER],
      "the wider sweep only follows students already holding books from the round's branches",
    );
    assert.isUndefined(
      match.$match["handoutInfo.handoutById"],
      "the second sweep does not care where the books were handed out",
    );
    assert.deepEqual(metrics.activeBooks, { books: 2, students: 1 });
  });

  test("counts members of the round's branches", async ({ assert }) => {
    const stubs = stubMongo({});

    await roundPlanMetrics(await createTestRound({ branches: [BRANCH] }));

    assert.deepEqual(stubs.userDetails.firstCall.args[0], [BRANCH]);
  });

  test("counts ordered books per book, not per order", async ({ assert }) => {
    stubMongo({});
    await order([ITEM_X, ITEM_Y]);
    await order([ITEM_Y]);

    const metrics = await roundPlanMetrics(await createTestRound({ branches: [BRANCH] }));

    assert.deepEqual(metrics.orderedBooks, { books: 2, students: 1 });
  });

  test("counts only open loans the students ordered themselves at the round's branches", async ({
    assert,
  }) => {
    stubMongo({});
    await order([ITEM_X], { branchId: OTHER_BRANCH });
    await order([ITEM_X], { byCustomer: false });
    await order([ITEM_X], { placed: false });
    await order([], { orderItems: [{ itemId: ITEM_X, type: "buy" }] });
    await order([], { orderItems: [{ itemId: ITEM_X, handout: true }] });
    const later = await order([]);
    await order([], { orderItems: [{ itemId: ITEM_X, movedToOrderId: later.id }] });

    const metrics = await roundPlanMetrics(await createTestRound({ branches: [BRANCH] }));

    assert.deepEqual(metrics.orderedBooks, { books: 0, students: 0 });
  });
});
