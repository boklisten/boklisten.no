import type { HttpContext } from "@adonisjs/core/http";
import testUtils from "@adonisjs/core/services/test_utils";
import { test } from "@japa/runner";

import ScopeMiddleware from "#middleware/scope_middleware";
import { createBranch } from "#tests/branch_fixtures";
import { contextFor, rejectionStatus } from "#tests/fixtures";
import { userDouble } from "#tests/user_fixtures";

async function runMiddleware(ctx: HttpContext): Promise<boolean> {
  let nextCalled = false;
  await new ScopeMiddleware().handle(ctx, () => {
    nextCalled = true;
    return Promise.resolve();
  });
  return nextCalled;
}

test.group("ScopeMiddleware", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("lets a branch in the caller's subtree through", async ({ assert }) => {
    const school = await createBranch();
    const klass = await createBranch({ parentBranchId: school.id });
    const manager = userDouble({ permission: "manager", employeeBranchId: school.id });

    assert.isTrue(await runMiddleware(contextFor(manager, { params: { branchId: klass.id } })));
    assert.isTrue(await runMiddleware(contextFor(manager, { params: { branchId: school.id } })));
  });

  test("stops a branch outside the subtree as unknown (404), so no stale link logs anyone out", async ({
    assert,
  }) => {
    const school = await createBranch();
    const sibling = await createBranch();
    const manager = userDouble({ permission: "manager", employeeBranchId: school.id });

    assert.equal(
      await rejectionStatus(
        runMiddleware(contextFor(manager, { params: { branchId: sibling.id } })),
      ),
      404,
    );
  });
});
