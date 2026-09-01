import { generateKeyPairSync, randomUUID, sign as signCrypto } from "node:crypto";

import testUtils from "@adonisjs/core/services/test_utils";
import { test } from "@japa/runner";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import Message from "#models/message";
import MessageEvent from "#models/message_event";
import { MessageLogService } from "#services/message_log_service";
import { StorageService } from "#services/storage_service";
import { verifySendgridSignature } from "#services/webhook_verification_service";
import { unchecked } from "#tests/test-doubles";

const CUSTOMER = "5d765db5fc8c47001c408d91";

async function logSms(recipient: string, overrides: { sendoutId?: number | null } = {}) {
  return await MessageLogService.logOutgoingMessage({
    channel: "sms",
    recipient,
    context: { messageType: "reminder", ...overrides },
    smsBody: "Husk boka!",
  });
}

test.group("MessageLogService", (group) => {
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
  });
  group.each.teardown(() => sandbox.restore());

  test("normalizes recipients on write: phone stripped to national digits, email lowercased", async ({
    assert,
  }) => {
    const sms = await logSms("+47 912 34 567");
    assert.equal(sms?.recipient, "91234567");

    const email = await MessageLogService.logOutgoingMessage({
      channel: "email",
      recipient: "  Ola.Nordmann@Example.COM ",
      context: { messageType: "receipt" },
    });
    assert.equal(email?.recipient, "ola.nordmann@example.com");
  });

  test("redacts token-bearing template variables before storing", async ({ assert }) => {
    const message = await MessageLogService.logOutgoingMessage({
      channel: "email",
      recipient: "kunde@example.com",
      context: { messageType: "password-reset" },
      templateId: "d-123",
      templateData: {
        passwordResetUri: "https://boklisten.no/auth/reset/1?token=secret",
        name: "Ola",
      },
    });
    assert.deepEqual(message?.templateData, {
      passwordResetUri: "[skjult]",
      name: "Ola",
    });
  });

  test("records send results with an internal event", async ({ assert }) => {
    const message = await logSms("91234567");
    await MessageLogService.recordSendResult(message, { status: "sent" });

    const stored = await Message.findOrFail(message?.id);
    assert.equal(stored.status, "sent");
    const events = await MessageEvent.query().where("messageId", stored.id);
    assert.lengthOf(events, 1);
    assert.equal(events[0]?.source, "internal");
    assert.equal(events[0]?.event, "sent");
  });

  test("provider events advance status by rank and never regress it", async ({ assert }) => {
    const message = await logSms("91234567");
    await MessageLogService.recordSendResult(message, { status: "sent" });

    await MessageLogService.recordProviderEvent({
      messageId: message!.id,
      source: "twilio",
      event: "delivered",
      occurredAt: DateTime.now(),
      providerEventId: "SM1:delivered",
      providerMessageId: "SM1",
    });
    let stored = await Message.findOrFail(message?.id);
    assert.equal(stored.status, "delivered");
    assert.equal(stored.providerMessageId, "SM1");

    // A late "queued" (ranked below delivered) only logs the event, the status stays.
    await MessageLogService.recordProviderEvent({
      messageId: message!.id,
      source: "twilio",
      event: "queued",
      occurredAt: DateTime.now(),
      providerEventId: "SM1:queued",
    });
    stored = await Message.findOrFail(message?.id);
    assert.equal(stored.status, "delivered");

    const events = await MessageEvent.query().where("messageId", stored.id);
    assert.lengthOf(events, 3);
  });

  test("failure events outrank delivery and stick", async ({ assert }) => {
    const message = await logSms("91234567");
    await MessageLogService.recordProviderEvent({
      messageId: message!.id,
      source: "twilio",
      event: "undelivered",
      errorCode: "30003",
      occurredAt: DateTime.now(),
      providerEventId: "SM2:undelivered",
    });
    const stored = await Message.findOrFail(message?.id);
    assert.equal(stored.status, "failed");
    assert.equal(stored.statusDetail, "30003");
  });

  test("duplicate provider events are dropped on provider_event_id", async ({ assert }) => {
    const message = await logSms("91234567");
    for (let attempt = 0; attempt < 2; attempt++) {
      await MessageLogService.recordProviderEvent({
        messageId: message!.id,
        source: "sendgrid",
        event: "delivered",
        occurredAt: DateTime.now(),
        providerEventId: "sg-evt-1",
      });
    }
    const events = await MessageEvent.query().where("messageId", message!.id);
    assert.lengthOf(events, 1);
  });

  test("provider events for unknown messages are reported, not thrown", async ({ assert }) => {
    const handled = await MessageLogService.recordProviderEvent({
      messageId: randomUUID(),
      source: "sendgrid",
      event: "delivered",
      occurredAt: DateTime.now(),
      providerEventId: "sg-evt-2",
    });
    assert.isFalse(handled);
  });

  test("customerLog collects messages to the customer's and guardian's current contact info", async ({
    assert,
  }) => {
    sandbox.stub(StorageService.UserDetails, "get").resolves(
      unchecked({
        id: CUSTOMER,
        email: "Elev@Example.com",
        phone: "91234567",
        guardian: { email: "foresatt@example.com", phone: "+4798765432" },
      }),
    );

    await logSms("91234567");
    await logSms("98765432");
    await MessageLogService.logOutgoingMessage({
      channel: "email",
      recipient: "elev@example.com",
      context: { messageType: "receipt" },
    });
    await logSms("11111111"); // unrelated recipient

    const { entries, recipients } = await MessageLogService.customerLog(CUSTOMER);
    assert.lengthOf(entries, 3);
    assert.sameMembers(recipients.phone, ["91234567", "98765432"]);
    assert.sameMembers(recipients.email, ["elev@example.com", "foresatt@example.com"]);
  });

  test("metrics fills every day in the period and counts failures", async ({ assert }) => {
    const sms = await logSms("91234567");
    await MessageLogService.recordSendResult(sms, { status: "send-failed", reason: "boom" });
    await MessageLogService.logOutgoingMessage({
      channel: "email",
      recipient: "elev@example.com",
      context: { messageType: "receipt" },
    });

    const metrics = await MessageLogService.metrics(7);
    assert.lengthOf(metrics.perDay, 8); // 7 days back + today
    const today = metrics.perDay.at(-1);
    assert.equal(today?.sms, 1);
    assert.equal(today?.email, 1);
    assert.equal(today?.failures, 1);
    assert.equal(metrics.failuresLast24h, 1);
    assert.equal(metrics.totalLast24h, 2);
    assert.equal(metrics.funnel.sms["send-failed"], 1);
    assert.equal(metrics.funnel.email["created"], 1);
  });

  test("sendoutStats aggregates message counts by status", async ({ assert }) => {
    const sendout = await MessageLogService.createSendout({ kind: "reminder", name: "Test" });
    const first = await logSms("91234567", { sendoutId: sendout?.id });
    await logSms("98765432", { sendoutId: sendout?.id });
    await MessageLogService.recordSendResult(first, { status: "sent" });

    const stats = await MessageLogService.sendoutStats(10);
    assert.lengthOf(stats, 1);
    assert.equal(stats[0]?.messageCount, 2);
    assert.equal(stats[0]?.statusCounts["sent"], 1);
    assert.equal(stats[0]?.statusCounts["created"], 1);

    const entries = await MessageLogService.feed({ limit: 10, sendoutId: sendout?.id });
    assert.lengthOf(entries, 2);
    assert.equal(entries[0]?.sendoutName, "Test");
  });
});

test.group("verifySendgridSignature", () => {
  test("accepts a valid ECDSA signature and rejects tampering", ({ assert }) => {
    const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const publicKeyBase64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");
    const timestamp = "1700000000";
    const rawBody = JSON.stringify([{ event: "delivered" }]);
    const signature = signCrypto("sha256", Buffer.from(timestamp + rawBody), privateKey).toString(
      "base64",
    );

    assert.isTrue(verifySendgridSignature({ publicKeyBase64, rawBody, signature, timestamp }));
    assert.isFalse(
      verifySendgridSignature({ publicKeyBase64, rawBody: `${rawBody} `, signature, timestamp }),
    );
    assert.isFalse(
      verifySendgridSignature({ publicKeyBase64: "not-a-key", rawBody, signature, timestamp }),
    );
  });
});
