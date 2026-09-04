import { test } from "@japa/runner";
import { errors } from "@vinejs/vine";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import DispatchService from "#services/dispatch_service";
import {
  BOKFLYT_CONTACT_RECIPIENT,
  BokflytContactService,
  buildBokflytContactMail,
} from "#services/bokflyt_contact_service";
import { bokflytContactValidator } from "#validators/bokflyt";

const VALID_REQUEST = {
  name: "  Kari Nordmann ",
  school: "Eksempel videregående skole",
  email: "Kari.Nordmann@Example.COM",
  phone: "91234567",
  message: "Vi vil gjerne høre mer.",
};

test.group("Bokflyt contact request", (group) => {
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
  });
  group.each.teardown(() => sandbox.restore());

  test("validator trims text, lowercases the email and keeps the message optional", async ({
    assert,
  }) => {
    const { message: _message, ...withoutMessage } = VALID_REQUEST;
    const validated = await bokflytContactValidator.validate(withoutMessage);

    assert.equal(validated.name, "Kari Nordmann");
    assert.equal(validated.email, "kari.nordmann@example.com");
    assert.isUndefined(validated.message);
  });

  test("validator rejects a phone number that is not a Norwegian mobile", async ({ assert }) => {
    await assert.rejects(
      () => bokflytContactValidator.validate({ ...VALID_REQUEST, phone: "12" }),
      errors.E_VALIDATION_ERROR,
    );
  });

  test("mail goes to the sales inbox with the school in the subject and the sender as reply-to", ({
    assert,
  }) => {
    const mail = buildBokflytContactMail({
      ...VALID_REQUEST,
      name: "Kari Nordmann",
      email: "kari.nordmann@example.com",
    });

    assert.equal(mail.to, BOKFLYT_CONTACT_RECIPIENT);
    assert.equal(mail.subject, "Bokflyt: henvendelse fra Eksempel videregående skole");
    assert.deepEqual(mail.replyTo, { email: "kari.nordmann@example.com", name: "Kari Nordmann" });
    assert.include(mail.text, "Skole: Eksempel videregående skole");
    assert.include(mail.text, "Telefon: 91234567");
    assert.include(mail.text, "Vi vil gjerne høre mer.");
  });

  test("an empty message is spelled out rather than left blank", ({ assert }) => {
    const mail = buildBokflytContactMail({ ...VALID_REQUEST, message: "   " });
    assert.include(mail.text, "(ingen melding)");
  });

  test("the mail is sent through the dispatch service under its own message type", async ({
    assert,
  }) => {
    const sendPlainEmail = sandbox
      .stub(DispatchService, "sendPlainEmail")
      .resolves({ success: true });

    await BokflytContactService.send(VALID_REQUEST);

    assert.isTrue(sendPlainEmail.calledOnce);
    const mail = sendPlainEmail.firstCall.args[0];
    assert.equal(mail.to, BOKFLYT_CONTACT_RECIPIENT);
    assert.equal(mail.subject, "Bokflyt: henvendelse fra Eksempel videregående skole");
    assert.deepEqual(mail.replyTo, { email: VALID_REQUEST.email, name: VALID_REQUEST.name });
    assert.deepEqual(mail.context, { messageType: "bokflyt-contact" });
  });
});
