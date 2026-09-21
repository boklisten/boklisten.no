import type { HttpContext } from "@adonisjs/core/http";
import testUtils from "@adonisjs/core/services/test_utils";
import { test } from "@japa/runner";
import { DateTime } from "luxon";
import { stub } from "sinon";

import User from "#models/user";
import { LoginService } from "#services/login_service";
import { ACTIVITY_RESOLUTION_MINUTES } from "#shared/user-activity";
import { mock, unchecked } from "#tests/test-doubles";
import { createUser } from "#tests/user_fixtures";

function contextFor(user: User, viaRemember = false) {
  const tag = stub().resolves();
  const ctx = mock<HttpContext>({
    // The guard's `use` is generic over the guard name; the double answers for the only one
    auth: { use: unchecked(() => ({ viaRemember, getUserOrFail: () => user })) },
    session: { tag },
  });
  return { ctx, tag };
}

async function storedActivity(user: User) {
  const stored = await User.findOrFail(user.id);
  return { lastActiveAt: stored.lastActiveAt?.toMillis() ?? null, updatedAt: stored.updatedAt };
}

test.group("LoginService.trackActivity()", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("tags the session the remember-me cookie restored with the user's id", async ({
    assert,
  }) => {
    const user = await createUser();
    const { ctx, tag } = contextFor(user, true);
    await LoginService.trackActivity(ctx);
    assert.isTrue(tag.calledOnceWithExactly(user.id));
  });

  test("leaves a session that was not restored on this request alone", async ({ assert }) => {
    const user = await createUser();
    const { ctx, tag } = contextFor(user);
    await LoginService.trackActivity(ctx);
    assert.isTrue(tag.notCalled);
  });

  test("records a first activity without counting it as an edit", async ({ assert }) => {
    const user = await createUser();
    const before = await storedActivity(user);
    assert.isNull(before.lastActiveAt);

    await LoginService.trackActivity(contextFor(user).ctx);

    const after = await storedActivity(user);
    assert.isNotNull(after.lastActiveAt);
    assert.equal(after.updatedAt?.toMillis(), before.updatedAt?.toMillis());
  });

  test("refreshes an activity older than the resolution and keeps a recent one", async ({
    assert,
  }) => {
    const user = await createUser();
    const stale = DateTime.now().minus({ minutes: 2 * ACTIVITY_RESOLUTION_MINUTES });
    user.lastActiveAt = stale;
    await User.query().where("id", user.id).update({ lastActiveAt: stale });

    await LoginService.trackActivity(contextFor(user).ctx);
    const refreshed = (await storedActivity(user)).lastActiveAt;
    assert.isNotNull(refreshed);
    assert.isAbove(refreshed ?? 0, stale.toMillis());

    // Every request loads the user afresh from the session, so the next one sees the refresh.
    await LoginService.trackActivity(contextFor(await User.findOrFail(user.id)).ctx);
    assert.equal((await storedActivity(user)).lastActiveAt, refreshed);
  });
});
