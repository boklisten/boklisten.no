import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import User from "#models/user";
import { BranchMembershipService } from "#services/branch_membership_service";
import DispatchService from "#services/dispatch_service";
import { assertMembershipAllowed, UserService } from "#services/user_service";
import { createBranch, rootBranch } from "#tests/branch_fixtures";
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
