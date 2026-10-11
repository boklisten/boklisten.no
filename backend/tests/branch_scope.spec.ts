import testUtils from "@adonisjs/core/services/test_utils";
import { test } from "@japa/runner";

import User from "#models/user";
import { BranchScope } from "#services/branch_scope";
import { createBranch, rootBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createUser } from "#tests/user_fixtures";

async function customerIdsInScope(nodeId: string): Promise<string[]> {
  const users = await User.query()
    .whereIn("id", BranchScope.customersInScope(await BranchScope.subtreeIds(nodeId)))
    .orderBy("id");
  return users.map((user) => user.id);
}

test.group("BranchScope.subtreeIds", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("holds the node itself and every branch below it", async ({ assert }) => {
    const school = await createBranch();
    const year = await createBranch({ parentBranchId: school.id });
    const klass = await createBranch({ parentBranchId: year.id });
    await createBranch();

    const ids = await BranchScope.subtreeIds(school.id);

    assert.sameMembers(ids, [school.id, year.id, klass.id]);
  });

  test("is just the node for a leaf", async ({ assert }) => {
    const klass = await createBranch();

    assert.deepEqual(await BranchScope.subtreeIds(klass.id), [klass.id]);
  });
});

test.group("BranchScope.customersInScope", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("finds a member of a descendant", async ({ assert }) => {
    const school = await createBranch();
    const klass = await createBranch({ parentBranchId: school.id });
    const pupil = await createUser({ branchMembershipId: klass.id });

    assert.deepEqual(await customerIdsInScope(school.id), [pupil.id]);
  });

  test("finds a root member with an order at a descendant", async ({ assert }) => {
    const school = await createBranch();
    const klass = await createBranch({ parentBranchId: school.id });
    const privatist = await createUser();
    await createOrder({ branchId: klass.id, customerId: privatist.id });

    assert.deepEqual(await customerIdsInScope(school.id), [privatist.id]);
  });

  test("finds a root member with a book handed out at a descendant", async ({ assert }) => {
    const school = await createBranch();
    const klass = await createBranch({ parentBranchId: school.id });
    const privatist = await createUser();
    const item = await createItem();
    await createCustomerItem({
      itemId: item.id,
      customerId: privatist.id,
      handoutBranchId: klass.id,
      returned: true,
    });

    assert.deepEqual(await customerIdsInScope(school.id), [privatist.id]);
  });

  test("finds a member of a sibling school with a cancelled order at a descendant", async ({
    assert,
  }) => {
    const school = await createBranch();
    const klass = await createBranch({ parentBranchId: school.id });
    const sibling = await createBranch();
    const pupil = await createUser({ branchMembershipId: sibling.id });
    const item = await createItem();
    await createOrder({
      branchId: klass.id,
      customerId: pupil.id,
      orderItems: [{ itemId: item.id, type: "cancel" }],
    });

    assert.deepEqual(await customerIdsInScope(school.id), [pupil.id]);
  });

  test("ignores a customer whose only activity is elsewhere", async ({ assert }) => {
    const school = await createBranch();
    const sibling = await createBranch();
    const pupil = await createUser({ branchMembershipId: sibling.id });
    await createOrder({ branchId: sibling.id, customerId: pupil.id });
    const item = await createItem();
    await createCustomerItem({
      itemId: item.id,
      customerId: pupil.id,
      handoutBranchId: sibling.id,
    });

    assert.deepEqual(await customerIdsInScope(school.id), []);
  });

  test("the root is in scope of everyone", async ({ assert }) => {
    const root = await rootBranch();
    const school = await createBranch();
    const pupil = await createUser({ branchMembershipId: school.id });
    const privatist = await createUser();

    assert.sameMembers(await customerIdsInScope(root.id), [pupil.id, privatist.id]);
  });
});
