import testUtils from "@adonisjs/core/services/test_utils";
import { test } from "@japa/runner";

import User from "#models/user";
import { BranchScope } from "#services/branch_scope";
import type { SliceNode } from "#services/branch_scope";
import { rejectionStatus } from "#tests/fixtures";
import { createBranch, createMiniatureTree, rootBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createUser, userDouble } from "#tests/user_fixtures";

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

test.group("BranchScope.ancestorIds", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("walks up to the root, nearest first, and is empty for the root", async ({ assert }) => {
    const root = await rootBranch();
    const school = await createBranch();
    const year = await createBranch({ parentBranchId: school.id });
    const klass = await createBranch({ parentBranchId: year.id });
    await createBranch();

    assert.deepEqual(await BranchScope.ancestorIds(klass.id), [year.id, school.id, root.id]);
    assert.deepEqual(await BranchScope.ancestorIds(root.id), []);
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

  test("holds every root member: a customer with no school belongs to every stand", async ({
    assert,
  }) => {
    const school = await createBranch();
    const privatist = await createUser();
    await createUser({ branchMembershipId: (await createBranch()).id });

    assert.deepEqual(await customerIdsInScope(school.id), [privatist.id]);
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

function sliceIds(slice: SliceNode[]) {
  return slice.map((node) => `${node.branch.id}:${node.selectable ? "yes" : "no"}`);
}

test.group("BranchScope.slice", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("a manager homed at a school gets the path above greyed and the subtree, no siblings", async ({
    assert,
  }) => {
    const { root, company, vgs, ullern, ullernVg1 } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });

    const slice = await BranchScope.slice(manager);

    assert.deepEqual(sliceIds(slice), [
      `${root.id}:no`,
      `${company.id}:no`,
      `${ullern.id}:yes`,
      `${ullernVg1.id}:yes`,
      `${vgs.id}:no`,
    ]);
    assert.sameMembers(await BranchScope.selectableIds(manager), [ullern.id, ullernVg1.id]);
  });

  test("an employee homed at a school gets the same slice as a manager there", async ({
    assert,
  }) => {
    const { ullern } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const employee = userDouble({ permission: "employee", employeeBranchId: ullern.id });

    assert.deepEqual(
      sliceIds(await BranchScope.slice(employee)),
      sliceIds(await BranchScope.slice(manager)),
    );
  });

  test("an admin gets every branch, all selectable, sorted by name", async ({ assert }) => {
    const { root, company, vgs, ullern, ullernVg1, nydalen } = await createMiniatureTree();
    const admin = userDouble({ permission: "admin", employeeBranchId: root.id });

    const slice = await BranchScope.slice(admin);

    assert.deepEqual(sliceIds(slice), [
      `${root.id}:yes`,
      `${company.id}:yes`,
      `${nydalen.id}:yes`,
      `${ullern.id}:yes`,
      `${ullernVg1.id}:yes`,
      `${vgs.id}:yes`,
    ]);
  });

  test("a customer gets the root and the public branches, no company, nothing greyed", async ({
    assert,
  }) => {
    const { root, vgs, ullern, ullernVg1, nydalen } = await createMiniatureTree();
    const customer = userDouble({ permission: "customer", employeeBranchId: root.id });

    const slice = await BranchScope.slice(customer);

    assert.deepEqual(sliceIds(slice), [
      `${root.id}:yes`,
      `${nydalen.id}:yes`,
      `${ullern.id}:yes`,
      `${ullernVg1.id}:yes`,
      `${vgs.id}:yes`,
    ]);
  });

  test("a guest is a customer homed at the root", async ({ assert }) => {
    const { root } = await createMiniatureTree();
    const customer = userDouble({ permission: "customer", employeeBranchId: root.id });

    assert.deepEqual(
      sliceIds(await BranchScope.slice(null)),
      sliceIds(await BranchScope.slice(customer)),
    );
  });
});

test.group("BranchScope.assertSelectable", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("lets a node in the subtree through and refuses a sibling school as unknown (404)", async ({
    assert,
  }) => {
    const { ullern, ullernVg1, nydalen } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });

    await assert.doesNotReject(() => BranchScope.assertSelectable(manager, ullernVg1.id));
    assert.equal(await rejectionStatus(BranchScope.assertSelectable(manager, nydalen.id)), 404);
  });

  test("refuses the root for staff homed below it, and an unknown id", async ({ assert }) => {
    const { root, ullern } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });

    for (const nodeId of [root.id, "000000000000000000000000"]) {
      assert.equal(await rejectionStatus(BranchScope.assertSelectable(manager, nodeId)), 404);
    }
  });

  test("a body value that is not selectable is a 400", async ({ assert }) => {
    const { ullern, nydalen } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });

    assert.equal(
      await rejectionStatus(BranchScope.assertSelectableTarget(manager, nydalen.id)),
      400,
    );
  });
});

test.group("BranchScope.customerInScope", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("a member of the subtree and a privatist who ordered there are in scope, a sibling's pupil is not", async ({
    assert,
  }) => {
    const { ullern, ullernVg1, nydalen } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const pupil = await createUser({ branchMembershipId: ullernVg1.id });
    const privatist = await createUser();
    await createOrder({ branchId: ullernVg1.id, customerId: privatist.id });
    const elsewhere = await createUser({ branchMembershipId: nydalen.id });

    assert.isTrue(await BranchScope.customerInScope(manager, pupil.id));
    assert.isTrue(await BranchScope.customerInScope(manager, privatist.id));
    assert.isFalse(await BranchScope.customerInScope(manager, elsewhere.id));
    assert.isFalse(await BranchScope.customerInScope(manager, "000000000000000000000000"));
    assert.equal(
      await rejectionStatus(BranchScope.assertCustomerInScope(manager, elsewhere.id)),
      404,
    );
    await assert.doesNotReject(() => BranchScope.assertCustomerInScope(manager, pupil.id));
  });

  test("a customer with no school is in scope of staff anywhere in the tree", async ({
    assert,
  }) => {
    const { ullern } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const privatist = await createUser();

    assert.isTrue(await BranchScope.customerInScope(manager, privatist.id));
  });

  test("head office sees everyone", async ({ assert }) => {
    const { root, nydalen } = await createMiniatureTree();
    const admin = userDouble({ permission: "admin", employeeBranchId: root.id });
    const elsewhere = await createUser({ branchMembershipId: nydalen.id });

    assert.isTrue(await BranchScope.customerInScope(admin, elsewhere.id));
  });
  test("staff count only where they are homed, whatever their membership or orders", async ({
    assert,
  }) => {
    const { root, ullern, ullernVg1 } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const headOffice = userDouble({ permission: "admin", employeeBranchId: root.id });
    const admin = await createUser({ permission: "admin" });
    const pupilEmployee = await createUser({
      permission: "employee",
      branchMembershipId: ullernVg1.id,
      employeeBranchId: ullernVg1.id,
    });
    const headOfficeMember = await createUser({
      permission: "employee",
      branchMembershipId: ullernVg1.id,
    });
    await createOrder({ branchId: ullernVg1.id, customerId: admin.id });

    assert.isFalse(await BranchScope.customerInScope(manager, admin.id));
    assert.isFalse(await BranchScope.customerInScope(manager, headOfficeMember.id));
    assert.isTrue(await BranchScope.customerInScope(manager, pupilEmployee.id));
    assert.isTrue(await BranchScope.customerInScope(headOffice, admin.id));
  });
});

test.group("BranchScope.placeInScope", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("a place is in scope at or below the home node only", async ({ assert }) => {
    const { root, ullern, ullernVg1, nydalen } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });

    assert.isTrue(await BranchScope.placeInScope(manager, ullern.id));
    assert.isTrue(await BranchScope.placeInScope(manager, ullernVg1.id));
    assert.isFalse(await BranchScope.placeInScope(manager, nydalen.id));
    assert.isFalse(await BranchScope.placeInScope(manager, root.id));
  });
});

test.group("BranchScope.blidInScope", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("a blid is in scope when nobody holds it, its holder is a customer in scope, or its history touches the subtree", async ({
    assert,
  }) => {
    const { ullern, ullernVg1, nydalen } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const item = await createItem();
    const pupil = await createUser({ branchMembershipId: ullernVg1.id });
    const stranger = await createUser({ branchMembershipId: nydalen.id });
    const book = (customerId: string, handoutBranchId: string, blid: string, returned = false) =>
      createCustomerItem({ itemId: item.id, customerId, handoutBranchId, blid, returned });
    await book(pupil.id, ullernVg1.id, "10000001");
    await book(stranger.id, nydalen.id, "10000002");
    await book(stranger.id, nydalen.id, "10000003", true);
    await book(pupil.id, nydalen.id, "10000004");
    await book(pupil.id, ullernVg1.id, "10000005", true);
    await book(stranger.id, nydalen.id, "10000005");
    await createCustomerItem({
      itemId: item.id,
      customerId: null,
      handoutBranchId: nydalen.id,
      blid: "10000006",
    });

    assert.isTrue(await BranchScope.blidInScope(manager, "10000001"), "held in the subtree");
    assert.isFalse(await BranchScope.blidInScope(manager, "10000002"), "a stranger's, elsewhere");
    assert.isTrue(await BranchScope.blidInScope(manager, "10000003"), "returned: nobody holds it");
    assert.isTrue(
      await BranchScope.blidInScope(manager, "10000004"),
      "an in-scope customer's, elsewhere",
    );
    assert.isTrue(
      await BranchScope.blidInScope(manager, "10000005"),
      "once handed out in the subtree",
    );
    assert.isTrue(
      await BranchScope.blidInScope(manager, "10000006"),
      "active row with no customer",
    );
    assert.isTrue(await BranchScope.blidInScope(manager, "99999999"), "unknown");
  });
});

test.group("BranchScope.customerItemInScope and orderInScope", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("a book or order is in scope by its place or by its customer", async ({ assert }) => {
    const { ullern, ullernVg1, nydalen } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const pupil = await createUser({ branchMembershipId: ullernVg1.id });
    const stranger = await createUser({ branchMembershipId: nydalen.id });

    assert.isTrue(
      await BranchScope.customerItemInScope(manager, {
        customerId: stranger.id,
        handoutBranchId: ullernVg1.id,
      }),
    );
    assert.isTrue(
      await BranchScope.customerItemInScope(manager, {
        customerId: pupil.id,
        handoutBranchId: nydalen.id,
      }),
    );
    assert.isFalse(
      await BranchScope.customerItemInScope(manager, {
        customerId: stranger.id,
        handoutBranchId: nydalen.id,
      }),
    );
    assert.isFalse(
      await BranchScope.customerItemInScope(manager, {
        customerId: null,
        handoutBranchId: nydalen.id,
      }),
    );
    assert.isTrue(
      await BranchScope.orderInScope(manager, { customerId: pupil.id, branchId: nydalen.id }),
    );
    assert.isFalse(
      await BranchScope.orderInScope(manager, { customerId: stranger.id, branchId: nydalen.id }),
    );
  });
});

test.group("BranchScope.manageableAmong", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("holds the people in scope whose level is not above the viewer's", async ({ assert }) => {
    const { root, ullern, ullernVg1, nydalen } = await createMiniatureTree();
    const employee = userDouble({ permission: "employee", employeeBranchId: ullern.id });
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const admin = userDouble({ permission: "admin", employeeBranchId: root.id });
    const pupil = await createUser({ branchMembershipId: ullernVg1.id });
    const colleague = await createUser({
      permission: "manager",
      branchMembershipId: ullernVg1.id,
      employeeBranchId: ullernVg1.id,
    });
    // Homed inside the subtree, so only the level keeps the manager away.
    const memberAdmin = await createUser({
      permission: "admin",
      branchMembershipId: ullernVg1.id,
      employeeBranchId: ullernVg1.id,
    });
    const elsewhere = await createUser({ branchMembershipId: nydalen.id });
    const ids = [pupil.id, colleague.id, memberAdmin.id, elsewhere.id];

    assert.sameMembers([...(await BranchScope.manageableAmong(employee, ids))], [pupil.id]);
    assert.sameMembers(
      [...(await BranchScope.manageableAmong(manager, ids))],
      [pupil.id, colleague.id],
    );
    assert.sameMembers([...(await BranchScope.manageableAmong(admin, ids))], ids);
    assert.equal((await BranchScope.manageableAmong(manager, [])).size, 0);
  });
});
