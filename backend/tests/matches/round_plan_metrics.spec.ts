import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import User from "#models/user";
import { roundPlanMetrics } from "#services/matches/round_plan_metrics";
import { createBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import {
  TEST_DEADLINE,
  createHeldBooks,
  createTestRound,
  ensureUsers,
  seedTestCatalogue,
} from "#tests/matches/match-testing-utils";
import { createOrder } from "#tests/order_fixtures";

const BRANCH = "5d765db5fc8c47001c408b01";
const OTHER_BRANCH = "5d765db5fc8c47001c408b09";
const SENDER = "5d765db5fc8c47001c408b02";
const OTHER_SENDER = "5d765db5fc8c47001c408b03";
const RECEIVER = "5d765db5fc8c47001c408d81";
const ITEM_X = "5d765db5fc8c47001c408e01";
const ITEM_Y = "5d765db5fc8c47001c408e02";

/** The student ordered the books themselves at the branch. */
const order = (itemIds: string[], overrides: Partial<Parameters<typeof createOrder>[0]> = {}) =>
  createOrder({
    branchId: BRANCH,
    customerId: RECEIVER,
    byCustomer: true,
    orderItems: itemIds.map((itemId) => ({ itemId })),
    ...overrides,
  });

test.group("roundPlanMetrics", (group) => {
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
  });
  group.each.teardown(() => sandbox.restore());
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(seedTestCatalogue);
  group.each.setup(() => ensureUsers([RECEIVER, SENDER, OTHER_SENDER]));
  group.each.setup(async () => {
    await createBranch({ id: BRANCH });
    await createBranch({ id: OTHER_BRANCH });
  });

  /** Stubs the member count and inserts the held books, handed out at the round's branch. */
  async function arrange({
    members,
    activeBooks,
  }: {
    members?: { students: number };
    activeBooks?: { id: string; items: string[] }[];
  }) {
    await createHeldBooks(BRANCH, activeBooks ?? []);
    return {
      userDetails: sandbox.stub(User, "countMembersOf").resolves(members?.students ?? 0),
    };
  }

  test("reports the members, the books out and the books ordered", async ({ assert }) => {
    await arrange({
      members: { students: 240 },
      activeBooks: [
        { id: SENDER, items: [ITEM_X, ITEM_Y] },
        { id: OTHER_SENDER, items: [ITEM_X] },
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
    await arrange({});

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
    await arrange({});
    await createHeldBooks(BRANCH, [{ id: SENDER, items: [ITEM_X, ITEM_Y] }]);
    // Due the day after the deadline, at another branch, and returned: none of them count
    await createHeldBooks(
      BRANCH,
      [{ id: OTHER_SENDER, items: [ITEM_X] }],
      TEST_DEADLINE.plus({ days: 1 }),
    );
    await createHeldBooks(OTHER_BRANCH, [{ id: OTHER_SENDER, items: [ITEM_Y] }]);
    await createCustomerItem({
      customerId: OTHER_SENDER,
      itemId: ITEM_X,
      handoutBranchId: BRANCH,
      deadline: TEST_DEADLINE,
      returned: true,
    });

    const metrics = await roundPlanMetrics(await createTestRound({ branches: [BRANCH] }));

    assert.deepEqual(metrics.activeBooks, { books: 2, students: 1 });
  });

  test("follows the students' other books when the plan includes other branches", async ({
    assert,
  }) => {
    await arrange({ activeBooks: [{ id: SENDER, items: [ITEM_X] }] });
    await createHeldBooks(OTHER_BRANCH, [{ id: SENDER, items: [ITEM_Y] }]);
    // Holds books only from another branch, so the wider sweep never reaches them
    await createHeldBooks(OTHER_BRANCH, [{ id: OTHER_SENDER, items: [ITEM_X] }]);

    const branchOnly = await roundPlanMetrics(await createTestRound({ branches: [BRANCH] }));
    const wider = await roundPlanMetrics(
      await createTestRound({
        branches: [BRANCH],
        includeCustomerItemsFromOtherBranches: true,
      }),
    );

    assert.deepEqual(branchOnly.activeBooks, { books: 1, students: 1 });
    assert.deepEqual(wider.activeBooks, { books: 2, students: 1 });
  });

  test("counts members of the round's branches", async ({ assert }) => {
    const stubs = await arrange({});

    await roundPlanMetrics(await createTestRound({ branches: [BRANCH] }));

    assert.deepEqual(stubs.userDetails.firstCall.args[0], [BRANCH]);
  });

  test("counts ordered books per book, not per order", async ({ assert }) => {
    await arrange({});
    await order([ITEM_X, ITEM_Y]);
    await order([ITEM_Y]);

    const metrics = await roundPlanMetrics(await createTestRound({ branches: [BRANCH] }));

    assert.deepEqual(metrics.orderedBooks, { books: 2, students: 1 });
  });

  test("counts only open loans the students ordered themselves at the round's branches", async ({
    assert,
  }) => {
    await arrange({});
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
