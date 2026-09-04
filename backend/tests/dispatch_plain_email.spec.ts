import sgMail from "@sendgrid/mail";
import testUtils from "@adonisjs/core/services/test_utils";
import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import Message from "#models/message";
import DispatchService from "#services/dispatch_service";
import { UserDetailService } from "#services/user_detail_service";
import env from "#start/env";
import { unchecked } from "#tests/test-doubles";

const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";

const PLAIN_MAIL = {
  to: "Info@Boklisten.no",
  subject: "Unntaksmelding: test",
  text: "Linje 1\nLinje 2",
  replyTo: { email: "kari@example.com", name: "Kari" },
  context: { messageType: "exception-report" as const, regardingCustomerDetailsId: CUSTOMER_ID },
};

function runAsProduction(sandbox: sinon.SinonSandbox) {
  const originalGet = env.get.bind(env);
  sandbox
    .stub(env, "get")
    .callsFake(
      unchecked((key: string) => (key === "API_ENV" ? "production" : originalGet(unchecked(key)))),
    );
}

test.group("DispatchService.sendPlainEmail", (group) => {
  let sandbox: sinon.SinonSandbox;
  let send: sinon.SinonStub;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
    send = sandbox.stub(sgMail, "send").resolves(unchecked([{ statusCode: 202 }, {}]));
    sandbox.stub(UserDetailService, "getByEmail").resolves(null);
  });
  group.each.teardown(() => sandbox.restore());

  test("outside production a mail to a non-employee address is logged as skipped, not sent", async ({
    assert,
  }) => {
    const { success } = await DispatchService.sendPlainEmail(PLAIN_MAIL);

    assert.isTrue(success);
    assert.isFalse(send.called);
    const logged = await Message.query().firstOrFail();
    assert.equal(logged.recipient, "info@boklisten.no");
    assert.equal(logged.status, "skipped");
    assert.equal(logged.messageType, "exception-report");
    assert.equal(logged.regardingCustomerDetailsId, CUSTOMER_ID);
    assert.equal(logged.subject, "Unntaksmelding: test");
    assert.deepEqual(logged.templateData, { text: "Linje 1\nLinje 2" });
  });

  test("in production the raw subject and text go to SendGrid and the log row is marked sent", async ({
    assert,
  }) => {
    runAsProduction(sandbox);

    const { success } = await DispatchService.sendPlainEmail(PLAIN_MAIL);

    assert.isTrue(success);
    assert.isTrue(send.calledOnce);
    const logged = await Message.query().firstOrFail();
    assert.deepInclude(send.firstCall.args[0], {
      from: "ikkesvar@boklisten.no",
      to: "Info@Boklisten.no",
      subject: "Unntaksmelding: test",
      text: "Linje 1\nLinje 2",
      replyTo: { email: "kari@example.com", name: "Kari" },
      customArgs: { bl_message_id: logged.id, bl_api_env: "production" },
    });
    assert.equal(logged.status, "sent");
  });

  test("a SendGrid failure is recorded on the log row and reported as unsuccessful", async ({
    assert,
  }) => {
    runAsProduction(sandbox);
    send.rejects(new Error("boom"));

    const { success } = await DispatchService.sendPlainEmail(PLAIN_MAIL);

    assert.isFalse(success);
    const logged = await Message.query().firstOrFail();
    assert.equal(logged.status, "send-failed");
    assert.include(logged.statusDetail ?? "", "boom");
  });
});
