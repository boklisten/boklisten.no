import type { HttpContext } from "@adonisjs/core/http";
import testUtils from "@adonisjs/core/services/test_utils";
import db from "@adonisjs/lucid/services/db";
import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import User from "#models/user";
import { AuthVippsService, loginTargetOf } from "#services/auth_vipps_service";
import { VippsLoginClient } from "#services/vipps/vipps_login_client";
import { clientOrigin } from "#config/app";
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

/**
 * A callback request from the browser that started the login, whose Vipps exchange yields
 * `person`, or fails with it when it is an error. `target` is the page the login started from.
 */
function callbackFor(sandbox: sinon.SinonSandbox, person: VippsUser | Error, target = "") {
  const finish = sandbox.stub(VippsLoginClient, "finish");
  if (person instanceof Error) {
    finish.rejects(person);
  } else {
    finish.resolves(person);
  }
  return requestTo({ state: "state" }, { state: "state", codeVerifier: "verifier", target });
}

/** A callback request carrying `query`, from a browser whose login cookie holds `cookie`. */
function requestTo(query: Record<string, string>, cookie?: object) {
  const redirect = createSandbox().stub();
  const ctx = mock<HttpContext>({
    request: {
      input: unchecked((name: string) => query[name]),
      encryptedCookie: unchecked(() => cookie),
      parsedUrl: { query: new URLSearchParams(query).toString() },
    },
    response: { redirect, clearCookie: unchecked(() => undefined) },
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

    await AuthVippsService.handleCallback(callbackFor(sandbox, vippsUser()).ctx);

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

    await AuthVippsService.handleCallback(callbackFor(sandbox, vippsUser()).ctx);

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
      const { ctx, redirect } = callbackFor(sandbox, vippsUser({ emailVerified: false }));

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
    const { ctx, redirect } = callbackFor(sandbox, vippsUser({ phoneNumber: "+4541111111" }));

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
    const { ctx, redirect } = callbackFor(sandbox, vippsUser({ phoneNumber: "+4541111111" }));

    await AuthVippsService.handleCallback(ctx);

    assert.equal(login.lastCall.args[1].id, me.id);
    assert.equal(redirect.lastCall.args[0], `${clientOrigin}/`);
    assert.equal((await User.findOrFail(me.id)).phone, "41111111");
  });

  test("finds the connected account first on the next Vipps login", async ({ assert }) => {
    const me = await createUser({
      email: "meg@example.com",
      phone: "93333333",
      vippsUserId: "vipps-kari",
    });
    await createUser({ email: "kari@example.com", phone: "41111111" });

    await AuthVippsService.handleCallback(callbackFor(sandbox, vippsUser()).ctx);

    assert.equal(login.lastCall.args[1].id, me.id);
    assert.equal((await User.findOrFail(me.id)).vippsUserId, "vipps-kari");
  });
});

test.group("AuthVippsService.handleCallback() destination", (group) => {
  let sandbox: sinon.SinonSandbox;
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox.stub(LoginService, "login").resolves();
  });
  group.each.teardown(() => sandbox.restore());

  test("lands on the page the login started from", async ({ assert }) => {
    await createUser({ email: "kari@example.com", phone: "41111111", vippsUserId: "vipps-kari" });
    const { ctx, redirect } = callbackFor(sandbox, vippsUser(), "handlekurv");

    await AuthVippsService.handleCallback(ctx);

    assert.equal(redirect.lastCall.args[0], `${clientOrigin}/handlekurv`);
  });

  test("goes through the pending tasks first, carrying the target along", async ({ assert }) => {
    await createUser({
      email: "kari@example.com",
      phone: "41111111",
      vippsUserId: "vipps-kari",
      taskConfirmDetails: true,
    });
    const { ctx, redirect } = callbackFor(sandbox, vippsUser(), "handlekurv");

    await AuthVippsService.handleCallback(ctx);

    assert.equal(redirect.lastCall.args[0], `${clientOrigin}/oppgaver?redirect=handlekurv`);
  });

  test("sends a failed Vipps exchange to the failure page", async ({ assert }) => {
    const { ctx, redirect } = callbackFor(sandbox, new Error("token exchange failed"));

    await AuthVippsService.handleCallback(ctx);

    assert.match(String(redirect.lastCall.args[0]), /\/auth\/failure\?reason=error$/);
  });

  test("explains the Vipps error {error} as {reason}")
    .with([
      { error: "access_denied", reason: "access_denied" },
      { error: "outdated_app_version", reason: "outdated_app_version" },
      { error: "wrong_challenge", reason: "wrong_challenge" },
      { error: "something_new", reason: "error" },
    ])
    .run(async ({ assert }, { error, reason }) => {
      const finish = sandbox.stub(VippsLoginClient, "finish");
      const { ctx, redirect } = requestTo(
        { error, state: "state" },
        { state: "state", codeVerifier: "verifier", target: "" },
      );

      await AuthVippsService.handleCallback(ctx);

      assert.isTrue(finish.notCalled);
      assert.equal(redirect.lastCall.args[0], `${clientOrigin}/auth/failure?reason=${reason}`);
    });

  test("refuses a callback that is not for the login this browser started", async ({ assert }) => {
    const finish = sandbox.stub(VippsLoginClient, "finish");
    const cookie = { state: "state", codeVerifier: "verifier", target: "" };

    for (const { ctx, redirect } of [
      requestTo({ code: "code", state: "other" }, cookie),
      requestTo({ code: "code", state: "state" }),
    ]) {
      await AuthVippsService.handleCallback(ctx);
      assert.match(String(redirect.lastCall.args[0]), /reason=expired$/);
    }
    assert.isTrue(finish.notCalled);
  });
});

test.group("loginTargetOf()", () => {
  test("keeps a page on the site: {0}")
    .with(["handlekurv", "admin/kasse?kunde=abc", "", "info/faq#svar"])
    .run(({ assert }, target) => {
      assert.equal(loginTargetOf(target), target);
    });

  test("drops anything that leaves the site: {0}")
    .with([
      "/evil.example",
      String.raw`\evil.example`,
      String.raw`/\evil.example`,
      "//evil.example/x",
      String.raw`./\evil.example`,
      ".//evil.example",
      "a/..//evil.example",
    ])
    .run(({ assert }, target) => {
      assert.equal(loginTargetOf(target), "");
    });

  test("drops a missing or non-string target", ({ assert }) => {
    assert.equal(loginTargetOf(undefined), "");
    assert.equal(loginTargetOf(["handlekurv"]), "");
  });
});
