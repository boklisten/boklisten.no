import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import User from "#models/user";
import DispatchService from "#services/dispatch_service";
import { assertMembershipAllowed, UserService } from "#services/user_service";
import { createBranch } from "#tests/branch_fixtures";

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

  test("keeping or clearing a hidden membership is allowed", async ({ assert }) => {
    const wang = await createBranch({ visibleToCustomers: false });

    await assert.doesNotReject(() => assertMembershipAllowed("customer", wang.id, wang.id));
    await assert.doesNotReject(() => assertMembershipAllowed("employee", wang.id, null));
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
