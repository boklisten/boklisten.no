import testUtils from "@adonisjs/core/services/test_utils";
import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import SmsCode from "#models/sms_code";
import DispatchService from "#services/dispatch_service";
import type { SmsCodeTarget } from "#services/sms_code_service";
import { LOCAL_CODE, SmsCodeService } from "#services/sms_code_service";
import { createUser } from "#tests/user_fixtures";

const LOGIN: SmsCodeTarget = { phone: "91234567", purpose: "login", userId: null };

/** Moves every stored code's send time into the past, past the wait between codes. */
async function backdate(minutes: number) {
  await SmsCode.query().update({
    createdAt: SmsCode.query().client.raw(`now() - interval '${minutes} minutes'`),
  });
}

test.group("SmsCodeService", (group) => {
  let sandbox: sinon.SinonSandbox;
  let sendSmsCode: sinon.SinonStub<
    Parameters<typeof DispatchService.sendSmsCode>,
    ReturnType<typeof DispatchService.sendSmsCode>
  >;
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
    sendSmsCode = sandbox.stub(DispatchService, "sendSmsCode").resolves();
    sandbox.stub(SmsCodeService, "localCode").value(null);
  });
  group.each.teardown(() => sandbox.restore());

  /** The code from the text of the SMS sent last. */
  function lastCode(): string {
    const [{ body }] = sendSmsCode.lastCall.args;
    return /#(?<code>\d{6})$/.exec(body)?.groups?.["code"] ?? "";
  }

  test("sends a six-digit code, stores only its hash and keeps it out of the log", async ({
    assert,
  }) => {
    assert.isNull(await SmsCodeService.issue(LOGIN, null));

    const code = lastCode();
    assert.match(code, /^\d{6}$/);
    const [stored] = await SmsCode.all();
    assert.notInclude(stored?.codeHash, code);
    const [{ loggedBody, messageType }] = sendSmsCode.lastCall.args;
    assert.notInclude(loggedBody, code);
    assert.equal(messageType, "login-code");
  });

  test("a valid code is used up", async ({ assert }) => {
    await SmsCodeService.issue(LOGIN, null);
    const code = lastCode();

    assert.equal(await SmsCodeService.check(LOGIN, code), "valid");
    assert.equal(await SmsCodeService.check(LOGIN, code), "expired");
  });

  test("a code survives five wrong guesses, not a sixth", async ({ assert }) => {
    await SmsCodeService.issue(LOGIN, null);
    const code = lastCode();
    const wrong = code === "000000" ? "111111" : "000000";

    for (let attempt = 0; attempt < 4; attempt++) {
      assert.equal(await SmsCodeService.check(LOGIN, wrong), "wrong");
    }
    assert.equal(await SmsCodeService.check(LOGIN, code), "valid");

    await backdate(1);
    await SmsCodeService.issue(LOGIN, null);
    for (let attempt = 0; attempt < 5; attempt++) {
      await SmsCodeService.check(LOGIN, wrong);
    }
    assert.equal(await SmsCodeService.check(LOGIN, lastCode()), "expired");
  });

  test("parallel requests for one number leave one live code and send one SMS", async ({
    assert,
  }) => {
    const answers = await Promise.all([
      SmsCodeService.issue(LOGIN, null),
      SmsCodeService.issue(LOGIN, null),
      SmsCodeService.issue(LOGIN, null),
    ]);

    assert.lengthOf(await SmsCode.all(), 1);
    assert.equal(sendSmsCode.callCount, 1);
    assert.lengthOf(
      answers.filter((answer) => answer === null),
      1,
    );
    assert.equal(await SmsCodeService.check(LOGIN, lastCode()), "valid");
  });

  test("an expired code is refused", async ({ assert }) => {
    await SmsCodeService.issue(LOGIN, null);
    await SmsCode.query().update({
      expiresAt: SmsCode.query().client.raw(`now() - interval '1 second'`),
    });

    assert.equal(await SmsCodeService.check(LOGIN, lastCode()), "expired");
  });

  test("asks for a pause between codes, then replaces the old one", async ({ assert }) => {
    await SmsCodeService.issue(LOGIN, null);
    const first = lastCode();

    assert.match((await SmsCodeService.issue(LOGIN, null)) ?? "", /^Vent \d+ sekunder/);
    assert.equal(sendSmsCode.callCount, 1);

    await backdate(1);
    assert.isNull(await SmsCodeService.issue(LOGIN, null));
    assert.lengthOf(await SmsCode.all(), 1);
    if (first !== lastCode()) {
      assert.equal(await SmsCodeService.check(LOGIN, first), "wrong");
    }
    assert.equal(await SmsCodeService.check(LOGIN, lastCode()), "valid");
  });

  test("fits one SMS on the longest host", async ({ assert }) => {
    await SmsCodeService.issue(
      { ...LOGIN, purpose: "phone-change", userId: (await createUser()).id },
      null,
    );
    const [{ body }] = sendSmsCode.lastCall.args;
    const longest = body.replace(/@\S+/, "@staging.boklisten.no");
    // GSM-7 holds æ, ø and å, so one segment is 160 characters.
    assert.isAtMost(longest.length, 160);
  });

  test("undeployed, every code is the fixed one and nothing is sent or awaited", async ({
    assert,
  }) => {
    sandbox.stub(SmsCodeService, "localCode").value(LOCAL_CODE);

    assert.isNull(await SmsCodeService.issue(LOGIN, null));
    assert.isNull(await SmsCodeService.issue(LOGIN, null));

    assert.isTrue(sendSmsCode.notCalled);
    assert.equal(await SmsCodeService.check(LOGIN, LOCAL_CODE), "valid");
  });

  test("a phone-change code proves the number only to the user who asked", async ({ assert }) => {
    const kari = await createUser();
    const ola = await createUser();
    const forKari: SmsCodeTarget = { phone: "41234567", purpose: "phone-change", userId: kari.id };
    await SmsCodeService.issue(forKari, kari.id);
    const code = lastCode();

    assert.equal(await SmsCodeService.check({ ...forKari, userId: ola.id }, code), "expired");
    assert.equal(
      await SmsCodeService.check({ ...forKari, purpose: "login", userId: null }, code),
      "expired",
    );
    assert.equal(await SmsCodeService.check(forKari, code), "valid");
  });
});
