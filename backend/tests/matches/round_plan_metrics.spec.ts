import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { roundPlanMetrics } from "#services/matches/round_plan_metrics";
import { StorageService } from "#services/storage_service";
import { TEST_DEADLINE, createTestRound } from "#tests/matches/match-testing-utils";
import { unchecked } from "#tests/test-doubles";

const BRANCH = "5d765db5fc8c47001c408b01";
const SENDER = "5d765db5fc8c47001c408b02";

test.group("roundPlanMetrics", (group) => {
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
  });
  group.each.teardown(() => sandbox.restore());
  group.each.setup(() => testUtils.db().truncate());

  /** Each collection aggregates to the per-student rows its pipeline groups into. */
  function stubMongo({
    members,
    activeBooks,
    orderedBooks,
  }: {
    members?: { students: number };
    activeBooks?: { id: string; items: string[] }[];
    orderedBooks?: { id: string; wantedItems: string[] }[];
  }) {
    return {
      userDetails: sandbox
        .stub(StorageService.UserDetails, "aggregate")
        .resolves(members ? [members] : []),
      customerItems: sandbox
        .stub(StorageService.CustomerItems, "aggregate")
        .resolves(activeBooks ?? []),
      orders: sandbox.stub(StorageService.Orders, "aggregate").resolves(orderedBooks ?? []),
    };
  }

  test("reports the members, the books out and the books ordered", async ({ assert }) => {
    stubMongo({
      members: { students: 240 },
      activeBooks: [
        { id: "sender-1", items: ["item-1", "item-2"] },
        { id: "sender-2", items: ["item-1"] },
      ],
      orderedBooks: [{ id: "receiver-1", wantedItems: ["item-1", "item-3"] }],
    });

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
          "handoutInfo.handoutBy"?: string;
        };
      },
    ] = unchecked(stubs.customerItems.secondCall.args[0]);
    assert.deepEqual(
      match.$match.customer.$in.map(String),
      [SENDER],
      "the wider sweep only follows students already holding books from the round's branches",
    );
    assert.isUndefined(
      match.$match["handoutInfo.handoutBy"],
      "the second sweep does not care where the books were handed out",
    );
    assert.deepEqual(metrics.activeBooks, { books: 2, students: 1 });
  });

  test("counts members of the round's branches", async ({ assert }) => {
    const stubs = stubMongo({});

    await roundPlanMetrics(await createTestRound({ branches: [BRANCH] }));

    const [match]: [{ $match: { branchMembership: { $in: { toString: () => string }[] } } }] =
      unchecked(stubs.userDetails.firstCall.args[0]);
    assert.deepEqual(match.$match.branchMembership.$in.map(String), [BRANCH]);
  });

  test("counts ordered books per book, not per order", async ({ assert }) => {
    const stubs = stubMongo({});

    await roundPlanMetrics(await createTestRound({ branches: [BRANCH] }));

    const pipeline = stubs.orders.firstCall.args[0];
    const unwindIndex = pipeline.findIndex((stage) => "$unwind" in stage);
    const groupIndex = pipeline.findIndex((stage) => "$group" in stage);
    assert.isAbove(unwindIndex, -1, "the order items have to be split apart to be counted");
    assert.isAbove(groupIndex, unwindIndex, "counting happens once each order item stands alone");
  });
});
