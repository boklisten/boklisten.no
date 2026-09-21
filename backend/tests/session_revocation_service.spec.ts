import testUtils from "@adonisjs/core/services/test_utils";
import db from "@adonisjs/lucid/services/db";
import { test } from "@japa/runner";
import { DateTime } from "luxon";

import { SessionRevocationService } from "#services/session_revocation_service";
import { createUser } from "#tests/user_fixtures";

async function seedLogin(userId: string, suffix: string) {
  const expiresAt = DateTime.now().plus({ hours: 1 }).toSQL();
  await db.table("sessions").insert({
    id: `sess_${userId}_${suffix}`,
    data: "{}",
    user_id: userId,
    expires_at: expiresAt,
  });
  await db.table("remember_me_tokens").insert({
    tokenable_id: userId,
    hash: `hash_${userId}_${suffix}`,
    created_at: DateTime.now().toSQL(),
    updated_at: DateTime.now().toSQL(),
    expires_at: expiresAt,
  });
}

async function loginsOf(userId: string) {
  const [sessions, tokens] = await Promise.all([
    db.from("sessions").where("user_id", userId).count("* as total").first(),
    db.from("remember_me_tokens").where("tokenable_id", userId).count("* as total").first(),
  ]);
  return { sessions: Number(sessions?.total), tokens: Number(tokens?.total) };
}

test.group("SessionRevocationService.revokeAll()", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("ends every session and remember-me token of the user, nobody else's", async ({
    assert,
  }) => {
    const [demoted, bystander] = await Promise.all([createUser(), createUser()]);
    await seedLogin(demoted.id, "phone");
    await seedLogin(demoted.id, "laptop");
    await seedLogin(bystander.id, "phone");

    await SessionRevocationService.revokeAll(demoted.id);

    assert.deepEqual(await loginsOf(demoted.id), { sessions: 0, tokens: 0 });
    assert.deepEqual(await loginsOf(bystander.id), { sessions: 1, tokens: 1 });
  });

  test("is a no-op for a user who is not logged in anywhere", async ({ assert }) => {
    const user = await createUser();
    await SessionRevocationService.revokeAll(user.id);
    assert.deepEqual(await loginsOf(user.id), { sessions: 0, tokens: 0 });
  });
});
