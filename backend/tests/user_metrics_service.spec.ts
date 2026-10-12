import testUtils from "@adonisjs/core/services/test_utils";
import { test } from "@japa/runner";
import { DateTime } from "luxon";

import User from "#models/user";
import { UserMetricsService } from "#services/user_metrics_service";
import { createBranch, rootBranch } from "#tests/branch_fixtures";
import { createUser } from "#tests/user_fixtures";

test.group("UserMetricsService.getMetrics", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("counts only the members of the given branches", async ({ assert }) => {
    const root = await rootBranch();
    const school = await createBranch();
    const klass = await createBranch({ parentBranchId: school.id });
    const sibling = await createBranch();
    const active = await createUser({ branchMembershipId: school.id, vippsUserId: "vipps-1" });
    await User.query().where("id", active.id).update({ lastActiveAt: DateTime.now() });
    await createUser({ branchMembershipId: klass.id });
    await createUser({ branchMembershipId: sibling.id });
    await createUser();

    const ullern = await UserMetricsService.getMetrics([school.id, klass.id]);
    assert.equal(ullern.totalUsers, 2);
    assert.equal(ullern.newLast30Days, 2);
    assert.equal(ullern.activeLast24Hours, 1);
    assert.deepEqual(ullern.loginMethods, { vipps: 1, sms: 0, none: 1 });
    assert.equal(ullern.registrationsByMonth.at(-1)?.totalUsers, 2);

    const everyone = await UserMetricsService.getMetrics([
      root.id,
      school.id,
      klass.id,
      sibling.id,
    ]);
    assert.equal(everyone.totalUsers, 4);

    const nobody = await UserMetricsService.getMetrics([sibling.id]);
    assert.equal(nobody.totalUsers, 1);
  });
});
