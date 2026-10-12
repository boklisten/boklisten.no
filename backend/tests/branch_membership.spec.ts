import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import User from "#models/user";
import { BranchMembershipService } from "#services/branch_membership_service";
import DispatchService from "#services/dispatch_service";
import { assertMembershipAllowed, UserService } from "#services/user_service";
import { createBranch, rootBranch } from "#tests/branch_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createUser } from "#tests/user_fixtures";

test.group("assertMembershipAllowed", (group) => {
  let sandbox: sinon.SinonSandbox;
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
  });
  group.each.teardown(() => sandbox.restore());

  test("registration refuses a membership in a hidden branch", async ({ assert }) => {
    sandbox.stub(DispatchService, "sendEmailVerification").resolves();
    const wang = await createBranch({ visibleToCustomers: false });

    await assert.rejects(
      () =>
        UserService.createSmsUser(
          {
            email: "ny@example.com",
            name: "Ny Kunde",
            address: "Gata 1",
            postalCode: "0001",
            dob: new Date("2005-01-01"),
            branchMembershipId: wang.id,
            guardianName: null,
          },
          "91234567",
        ),
      /Du kan ikke velge denne skolen/,
    );
    assert.lengthOf(await User.all(), 0);
  });

  test("a customer may pick a public branch but not a hidden one", async ({ assert }) => {
    const ullern = await createBranch({ visibleToCustomers: true });
    const wang = await createBranch({ visibleToCustomers: false });

    await assertMembershipAllowed("customer", null, ullern.id);
    await assert.rejects(
      () => assertMembershipAllowed("customer", null, wang.id),
      /Du kan ikke velge denne skolen/,
    );
  });

  test("keeping a hidden membership is allowed", async ({ assert }) => {
    const wang = await createBranch({ visibleToCustomers: false });

    await assert.doesNotReject(() => assertMembershipAllowed("customer", wang.id, wang.id));
  });

  test("the root is always an allowed target, though hidden from customers", async ({ assert }) => {
    const root = await rootBranch();
    const wang = await createBranch({ visibleToCustomers: false });

    await assert.doesNotReject(() => assertMembershipAllowed("customer", wang.id, root.id));
    await assert.doesNotReject(() => assertMembershipAllowed("employee", null, root.id));
  });

  test("staff may pick a branch customers do not see", async ({ assert }) => {
    const staffOnly = await createBranch({ visibleToCustomers: false });

    await assert.doesNotReject(() => assertMembershipAllowed("employee", null, staffOnly.id));
    await assert.doesNotReject(() => assertMembershipAllowed("admin", null, staffOnly.id));
  });

  test("an unknown branch is refused", async ({ assert }) => {
    await assert.rejects(
      () => assertMembershipAllowed("admin", null, "5d765db5fc8c47001c408dff"),
      /Du kan ikke velge denne skolen/,
    );
  });
});

test.group("Membership defaults to the root", (group) => {
  let sandbox: sinon.SinonSandbox;
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
  });
  group.each.teardown(() => sandbox.restore());

  test("a sign-up that names no school lands on the root", async ({ assert }) => {
    sandbox.stub(DispatchService, "sendEmailVerification").resolves();
    const root = await rootBranch();

    const user = await UserService.createSmsUser(
      {
        email: "ny@example.com",
        name: "Ny Kunde",
        address: "Gata 1",
        postalCode: "0001",
        dob: new Date("2005-01-01"),
        guardianName: null,
      },
      "91234567",
    );

    assert.equal(user.branchMembershipId, root.id);
    assert.equal((await User.findOrFail(user.id)).branchMembershipId, root.id);
  });

  test("a sign-up that names a school keeps it", async ({ assert }) => {
    sandbox.stub(DispatchService, "sendEmailVerification").resolves();
    const ullern = await createBranch({ visibleToCustomers: true });

    const user = await UserService.createSmsUser(
      {
        email: "ny@example.com",
        name: "Ny Kunde",
        address: "Gata 1",
        postalCode: "0001",
        dob: new Date("2005-01-01"),
        branchMembershipId: ullern.id,
        guardianName: null,
      },
      "91234567",
    );

    assert.equal(user.branchMembershipId, ullern.id);
  });

  test("a Vipps sign-up lands on the root", async ({ assert }) => {
    const root = await rootBranch();

    const user = await UserService.createVippsUser({
      id: "vipps-1",
      name: "Kari Nordmann",
      email: "kari@example.com",
      emailVerified: true,
      phoneNumber: "91234567",
      phoneNumberVerified: true,
      address: "",
      postalCode: "",
    });

    assert.equal(user.branchMembershipId, root.id);
  });

  test("a provisioned customer without a class lands on the root", async ({ assert }) => {
    const root = await rootBranch();

    const user = await UserService.createProvisionedUser(
      { name: "Ola Nordmann", phone: "91234567", email: "ola@example.com" },
      undefined,
    );

    assert.equal(user.branchMembershipId, root.id);
  });
});

test.group("BranchMembershipService.moveMembersToRoot", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("moves the direct members of a branch to the root, nobody else", async ({ assert }) => {
    const root = await rootBranch();
    const school = await createBranch();
    const klass = await createBranch({ parentBranchId: school.id });
    const direct = await createUser({ branchMembershipId: school.id });
    const inClass = await createUser({ branchMembershipId: klass.id });

    await BranchMembershipService.moveMembersToRoot(school.id, "direct");

    assert.equal((await User.findOrFail(direct.id)).branchMembershipId, root.id);
    assert.equal((await User.findOrFail(inClass.id)).branchMembershipId, klass.id);
  });

  test("moves the members of the branches below to the root, not the direct ones", async ({
    assert,
  }) => {
    const root = await rootBranch();
    const school = await createBranch();
    const klass = await createBranch({ parentBranchId: school.id });
    const direct = await createUser({ branchMembershipId: school.id });
    const inClass = await createUser({ branchMembershipId: klass.id });

    await BranchMembershipService.moveMembersToRoot(school.id, "indirect");

    assert.equal((await User.findOrFail(direct.id)).branchMembershipId, school.id);
    assert.equal((await User.findOrFail(inClass.id)).branchMembershipId, root.id);
  });

  test("refuses on the root, which has nowhere to move people to", async ({ assert }) => {
    const root = await rootBranch();
    const school = await createBranch();
    const member = await createUser({ branchMembershipId: school.id });

    await assert.rejects(() => BranchMembershipService.moveMembersToRoot(root.id, "direct"));
    await assert.rejects(() => BranchMembershipService.moveMembersToRoot(root.id, "indirect"));
    assert.equal((await User.findOrFail(member.id)).branchMembershipId, school.id);
  });
});

test.group("BranchMembershipService.getPage", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("lists the members of the branches below the node by name, with the node's counts", async ({
    assert,
  }) => {
    const school = await createBranch();
    const klass = await createBranch({ parentBranchId: school.id });
    const sibling = await createBranch();
    await createUser({ name: "Berit", branchMembershipId: school.id });
    const inClass = await createUser({ name: "Anne", branchMembershipId: klass.id });
    await createUser({ name: "Carl", branchMembershipId: sibling.id });

    const page = await BranchMembershipService.getPage(school.id, { scope: "descendants" });

    assert.deepEqual(
      page.members.map((member) => member.id),
      [inClass.id],
    );
    assert.deepEqual(page.members[0], {
      id: inClass.id,
      name: "Anne",
      yearOfBirth: "2000",
      branchMembershipId: klass.id,
    });
    assert.deepEqual(page.counts, { direct: 1, indirect: 1 });
    assert.isNull(page.nextCursor);
  });

  test("direct lists the node's own members only, the counts stay", async ({ assert }) => {
    const school = await createBranch();
    const klass = await createBranch({ parentBranchId: school.id });
    const direct = await createUser({ branchMembershipId: school.id });
    await createUser({ branchMembershipId: klass.id });

    const page = await BranchMembershipService.getPage(school.id, { scope: "direct" });

    assert.deepEqual(
      page.members.map((member) => member.id),
      [direct.id],
    );
    assert.deepEqual(page.counts, { direct: 1, indirect: 1 });
  });

  test("descendants of a leaf is an empty page with no members below", async ({ assert }) => {
    const school = await createBranch();
    await createUser({ branchMembershipId: school.id });

    const page = await BranchMembershipService.getPage(school.id, { scope: "descendants" });

    assert.deepEqual(page.members, []);
    assert.deepEqual(page.counts, { direct: 1, indirect: 0 });
    assert.isNull(page.nextCursor);
  });

  test("descendants of the root is everyone with a school, not the schoolless", async ({
    assert,
  }) => {
    const root = await rootBranch();
    const school = await createBranch();
    await createUser({ name: "Uten skole", branchMembershipId: root.id });
    const pupil = await createUser({ name: "Elev", branchMembershipId: school.id });

    const page = await BranchMembershipService.getPage(root.id, { scope: "descendants" });

    assert.deepEqual(
      page.members.map((member) => member.id),
      [pupil.id],
    );
    assert.deepEqual(page.counts, { direct: 1, indirect: 1 });
  });

  test("a customer who only ordered at the school is not one of its members", async ({
    assert,
  }) => {
    const school = await createBranch();
    const privatist = await createUser();
    await createOrder({ branchId: school.id, customerId: privatist.id });

    const page = await BranchMembershipService.getPage(school.id, { scope: "direct" });

    assert.deepEqual(page.members, []);
    assert.deepEqual(page.counts, { direct: 0, indirect: 0 });
  });

  test("pages after the cursor without repeating or skipping members who share a name", async ({
    assert,
  }) => {
    const school = await createBranch();
    const members = await Promise.all(
      ["Kari", "Kari", "Kari", "Ola"].map((name) =>
        createUser({ name, branchMembershipId: school.id }),
      ),
    );
    // Plain code-point order, as Postgres sorts these ASCII names and hex ids.
    const expected = members
      .toSorted((a, b) => (a.name === b.name ? (a.id < b.id ? -1 : 1) : a.name! < b.name! ? -1 : 1))
      .map((member) => member.id);

    const first = await BranchMembershipService.getPage(school.id, { scope: "direct", limit: 2 });
    assert.lengthOf(first.members, 2);
    assert.isNotNull(first.nextCursor);

    const second = await BranchMembershipService.getPage(school.id, {
      scope: "direct",
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    });
    assert.lengthOf(second.members, 2);
    assert.isNull(second.nextCursor);

    assert.deepEqual(
      [...first.members, ...second.members].map((member) => member.id),
      expected,
    );
  });

  test("a page that ends exactly at the last member has no next cursor", async ({ assert }) => {
    const school = await createBranch();
    await createUser({ branchMembershipId: school.id });
    await createUser({ branchMembershipId: school.id });

    const page = await BranchMembershipService.getPage(school.id, { scope: "direct", limit: 2 });

    assert.lengthOf(page.members, 2);
    assert.isNull(page.nextCursor);
  });

  test("the cursor still works when the member it points at was renamed or deleted", async ({
    assert,
  }) => {
    const school = await createBranch();
    const anne = await createUser({ name: "Anne", branchMembershipId: school.id });
    const berit = await createUser({ name: "Berit", branchMembershipId: school.id });
    const carl = await createUser({ name: "Carl", branchMembershipId: school.id });

    const first = await BranchMembershipService.getPage(school.id, { scope: "direct", limit: 1 });
    assert.deepEqual(
      first.members.map((member) => member.id),
      [anne.id],
    );
    await anne.delete();
    const second = await BranchMembershipService.getPage(school.id, {
      scope: "direct",
      limit: 1,
      cursor: first.nextCursor ?? undefined,
    });
    assert.deepEqual(
      second.members.map((member) => member.id),
      [berit.id],
    );

    await berit.merge({ name: "Zara" }).save();
    const third = await BranchMembershipService.getPage(school.id, {
      scope: "direct",
      limit: 1,
      cursor: second.nextCursor ?? undefined,
    });
    assert.deepEqual(
      third.members.map((member) => member.id),
      [carl.id],
    );
  });

  test("a member without a name sorts first and pages like any other", async ({ assert }) => {
    const school = await createBranch();
    const nameless = await createUser({ name: null, branchMembershipId: school.id });
    const named = await createUser({ name: "Anne", branchMembershipId: school.id });

    const first = await BranchMembershipService.getPage(school.id, { scope: "direct", limit: 1 });
    const second = await BranchMembershipService.getPage(school.id, {
      scope: "direct",
      limit: 1,
      cursor: first.nextCursor ?? undefined,
    });

    assert.deepEqual(
      first.members.map((member) => member.id),
      [nameless.id],
    );
    assert.equal(first.members[0]?.name, "");
    assert.deepEqual(
      second.members.map((member) => member.id),
      [named.id],
    );
  });
});
