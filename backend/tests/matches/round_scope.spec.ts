import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";

import { assertStandRules } from "#services/matches/round_scope";
import { createBranch } from "#tests/branch_fixtures";
import { ensureUsers } from "#tests/matches/match-testing-utils";

const STUDENT = "5d765db5fc8c47001c408d81";
const NOBODY = "5d765db5fc8c47001c408d99";

function rejection(run: () => Promise<void>): Promise<Error | null> {
  return run().then(
    () => null,
    (error: Error) => error,
  );
}

test.group("assertStandRules", (group) => {
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => ensureUsers([STUDENT]));

  test("accepts descendants of the round's branch and students that exist", async ({ assert }) => {
    const root = await createBranch();
    const program = await createBranch({ parentBranchId: root.id });
    const standClass = await createBranch({ parentBranchId: program.id });

    assert.isNull(
      await rejection(() =>
        assertStandRules(root.id, {
          standBranchIds: [program.id, standClass.id],
          standCustomerIds: [STUDENT],
        }),
      ),
    );
    assert.isNull(await rejection(() => assertStandRules(root.id, {})));
  });

  test("rejects the round's own branch and branches outside it", async ({ assert }) => {
    const root = await createBranch();
    const outside = await createBranch();

    assert.isNotNull(
      await rejection(() => assertStandRules(root.id, { standBranchIds: [root.id] })),
      "the branch itself would send every book to the stand",
    );
    assert.isNotNull(
      await rejection(() => assertStandRules(root.id, { standBranchIds: [outside.id] })),
    );
  });

  test("rejects a student that does not exist", async ({ assert }) => {
    const root = await createBranch();

    assert.isNotNull(
      await rejection(() => assertStandRules(root.id, { standCustomerIds: [STUDENT, NOBODY] })),
    );
  });
});
