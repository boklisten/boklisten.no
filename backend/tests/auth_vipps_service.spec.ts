import type { HttpContext } from "@adonisjs/core/http";
import testUtils from "@adonisjs/core/services/test_utils";
import db from "@adonisjs/lucid/services/db";
import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import User from "#models/user";
import { AuthVippsService } from "#services/auth_vipps_service";
import { LoginService } from "#services/login_service";
import type { VippsUser } from "#types/user";
import { mock, unchecked } from "#tests/test-doubles";
import { createUser } from "#tests/user_fixtures";

function vippsUser(overrides: Partial<VippsUser> = {}): VippsUser {
  return {
    id: "vipps-kari",
    name: "Kari Nordmann",
    email: "kari@example.com",
    emailVerified: true,
    phoneNumber: "41111111",
    phoneNumberVerified: true,
    address: "",
    postalCode: "",
    postalCity: "",
    ...overrides,
  };
}

/** A callback request whose Vipps login went through for `person`. */
function callbackFor(person: VippsUser) {
  const redirect = createSandbox().stub();
  const ctx = mock<HttpContext>({
    ally: {
      use: unchecked(() => ({
        accessDenied: () => false,
        stateMisMatch: () => false,
        hasError: () => false,
        user: async () => person,
      })),
    },
    response: { redirect },
  });
  return { ctx, redirect };
}

async function sessionsOf(userId: string): Promise<number> {
  const row = await db.from("sessions").where("user_id", userId).count("* as total").first();
  return Number(row?.total ?? 0);
}

test.group("AuthVippsService.handleCallback()", (group) => {
  let sandbox: sinon.SinonSandbox;
  let login: sinon.SinonStub<
    Parameters<typeof LoginService.login>,
    ReturnType<typeof LoginService.login>
  >;
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
    login = sandbox.stub(LoginService, "login").resolves();
  });
  group.each.teardown(() => sandbox.restore());

  test("takes back an account that only claimed the email, and ends its other logins", async ({
    assert,
  }) => {
    const claimed = await createUser({
      email: "kari@example.com",
      emailConfirmed: false,
      phone: "92222222",
    });
    await db.table("sessions").insert({
      id: "claimant-session",
      data: "{}",
      user_id: claimed.id,
      expires_at: new Date(Date.now() + 3_600_000),
    });

    await AuthVippsService.handleCallback(callbackFor(vippsUser()).ctx);

    const account = await User.findOrFail(claimed.id);
    assert.equal(account.phone, "41111111");
    assert.isTrue(account.emailConfirmed);
    assert.equal(account.vippsUserId, "vipps-kari");
    assert.equal(await sessionsOf(claimed.id), 0);
    assert.lengthOf(await User.all(), 1);
  });

  test("leaves an account with a confirmed email as it is", async ({ assert }) => {
    const owner = await createUser({
      email: "kari@example.com",
      emailConfirmed: true,
      phone: "92222222",
    });

    await AuthVippsService.handleCallback(callbackFor(vippsUser()).ctx);

    const account = await User.findOrFail(owner.id);
    assert.equal(account.phone, "92222222");
    assert.equal(account.vippsUserId, "vipps-kari");
  });

  test("never opens an account by an email Vipps has not verified")
    .with([false, true])
    .run(async ({ assert }, emailConfirmed) => {
      const owner = await createUser({
        email: "kari@example.com",
        emailConfirmed,
        phone: "92222222",
      });
      const { ctx, redirect } = callbackFor(vippsUser({ emailVerified: false }));

      await AuthVippsService.handleCallback(ctx);

      assert.isTrue(login.notCalled);
      assert.match(String(redirect.lastCall.args[0]), /reason=email_in_use$/);
      const account = await User.findOrFail(owner.id);
      assert.equal(account.phone, "92222222");
      assert.equal(account.emailConfirmed, emailConfirmed);
      assert.isNull(account.vippsUserId);
    });

  test("refuses a number from outside Norway", async ({ assert }) => {
    await createUser({ email: "annen@example.com", phone: "41111111" });
    const { ctx, redirect } = callbackFor(vippsUser({ phoneNumber: "+4541111111" }));

    await AuthVippsService.handleCallback(ctx);

    assert.isTrue(login.notCalled);
    assert.match(String(redirect.lastCall.args[0]), /reason=error$/);
  });

  test("logs in a connected account whose Vipps number is now from outside Norway", async ({
    assert,
  }) => {
    const me = await createUser({
      email: "kari@example.com",
      phone: "41111111",
      vippsUserId: "vipps-kari",
    });
    const { ctx, redirect } = callbackFor(vippsUser({ phoneNumber: "+4541111111" }));

    await AuthVippsService.handleCallback(ctx);

    assert.equal(login.lastCall.args[1].id, me.id);
    assert.match(String(redirect.lastCall.args[0]), /\/auth\/callback$/);
    assert.equal((await User.findOrFail(me.id)).phone, "41111111");
  });

  test("finds the connected account first on the next Vipps login", async ({ assert }) => {
    const me = await createUser({
      email: "meg@example.com",
      phone: "93333333",
      vippsUserId: "vipps-kari",
    });
    await createUser({ email: "kari@example.com", phone: "41111111" });

    await AuthVippsService.handleCallback(callbackFor(vippsUser()).ctx);

    assert.equal(login.lastCall.args[1].id, me.id);
    assert.equal((await User.findOrFail(me.id)).vippsUserId, "vipps-kari");
  });
});
