import logger from "@adonisjs/core/services/logger";
import db from "@adonisjs/lucid/services/db";
import { DateTime } from "luxon";

import Message from "#models/message";
import MessageEvent from "#models/message_event";
import Sendout from "#models/sendout";
import { StorageService } from "#services/storage_service";
import type {
  MessageChannel,
  MessageEventDto,
  MessageLogEntryDto,
  MessageLogMetricsDto,
  MessageStatus,
  MessageType,
  SendoutKind,
  SendoutStatsDto,
} from "#shared/message-log";
import { FAILURE_MESSAGE_STATUSES, MESSAGE_CHANNELS, MESSAGE_STATUSES } from "#shared/message-log";

/**
 * Higher rank wins; a status only ever advances. Failures outrank everything so a late engagement
 * event cannot mask them, and a spam report outranks delivery but not a hard failure.
 */
const STATUS_RANK: Record<MessageStatus, number> = {
  created: 0,
  skipped: 1,
  sent: 2,
  delivered: 3,
  opened: 4,
  clicked: 5,
  spam: 6,
  bounced: 10,
  failed: 10,
  "send-failed": 10,
};

/**
 * Template variables whose values grant access to act as the recipient. The log is readable by
 * every employee, so these must never be stored.
 */
const REDACTED_TEMPLATE_KEYS = new Set([
  "passwordResetUri",
  "emailVerificationUri",
  "signatureUri",
  "guardianSignatureUri",
]);

/** Twilio message statuses → our denormalized status. Unknown statuses leave the status as-is. */
const TWILIO_STATUS_MAP: Record<string, MessageStatus> = {
  queued: "sent",
  sending: "sent",
  sent: "sent",
  delivered: "delivered",
  read: "opened",
  undelivered: "failed",
  failed: "failed",
};

/** SendGrid webhook events → our denormalized status. Absent events (deferred, …) only log. */
const SENDGRID_EVENT_MAP: Record<string, MessageStatus> = {
  processed: "sent",
  delivered: "delivered",
  open: "opened",
  click: "clicked",
  bounce: "bounced",
  dropped: "failed",
  spamreport: "spam",
};

function normalizePhone(phone: string): string {
  const digits = phone.replaceAll(/\D/g, "");
  return digits.length === 10 && digits.startsWith("47") ? digits.slice(2) : digits;
}

function normalizeRecipient(channel: MessageChannel, recipient: string): string {
  return channel === "sms" ? normalizePhone(recipient) : recipient.trim().toLowerCase();
}

function redactTemplateData(
  templateData: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!templateData) {
    return null;
  }
  return Object.fromEntries(
    Object.entries(templateData).map(([key, value]) => [
      key,
      REDACTED_TEMPLATE_KEYS.has(key) ? "[skjult]" : value,
    ]),
  );
}

export interface MessageLogContext {
  messageType: MessageType;
  sendoutId?: number | null;
  regardingCustomerDetailsId?: string | null;
}

async function createSendout(input: {
  kind: SendoutKind;
  name?: string | null;
  initiatedByDetailsId?: string | null;
}): Promise<Sendout | null> {
  try {
    return await Sendout.create({
      kind: input.kind,
      name: input.name ?? null,
      initiatedByDetailsId: input.initiatedByDetailsId ?? null,
    });
  } catch (error) {
    logger.error(`failed to create sendout: ${error}`);
    return null;
  }
}

/**
 * Records an outgoing message before the provider is called. Logging must never break sending, so
 * failures return null and the send proceeds unlogged.
 */
async function logOutgoingMessage(input: {
  channel: MessageChannel;
  recipient: string;
  context: MessageLogContext;
  subject?: string | null;
  smsBody?: string | null;
  templateId?: string | null;
  templateData?: Record<string, unknown>;
}): Promise<Message | null> {
  try {
    return await Message.create({
      channel: input.channel,
      recipient: normalizeRecipient(input.channel, input.recipient),
      messageType: input.context.messageType,
      sendoutId: input.context.sendoutId ?? null,
      regardingCustomerDetailsId: input.context.regardingCustomerDetailsId ?? null,
      subject: input.subject ?? null,
      smsBody: input.smsBody ?? null,
      templateId: input.templateId ?? null,
      templateData: redactTemplateData(input.templateData),
      status: "created",
    });
  } catch (error) {
    logger.error(`failed to log outgoing message to "${input.recipient}": ${error}`);
    return null;
  }
}

/** Records the immediate outcome of handing the message to the provider. */
async function recordSendResult(
  message: Message | null,
  result: { status: "sent" | "send-failed" | "skipped"; reason?: string },
): Promise<void> {
  if (!message) {
    return;
  }
  try {
    await MessageEvent.create({
      messageId: message.id,
      source: "internal",
      event: result.status,
      reason: result.reason ?? null,
      occurredAt: DateTime.now(),
    });
    message.status = result.status;
    message.statusDetail = result.reason ?? null;
    await message.save();
  } catch (error) {
    logger.error(`failed to record send result for message "${message.id}": ${error}`);
  }
}

/**
 * Appends a provider webhook event and advances the message status when the event outranks the
 * current one. Duplicate webhook deliveries are dropped on `provider_event_id`. Returns false when
 * the message is unknown (e.g. an event for the other environment or a deleted row).
 */
async function recordProviderEvent(input: {
  messageId: string;
  source: "twilio" | "sendgrid";
  event: string;
  errorCode?: string | null;
  reason?: string | null;
  payload?: Record<string, unknown>;
  occurredAt: DateTime;
  providerEventId: string;
  providerMessageId?: string | null;
}): Promise<boolean> {
  const message = await Message.find(input.messageId);
  if (!message) {
    return false;
  }

  const inserted = await db
    .table("message_events")
    .insert({
      message_id: message.id,
      source: input.source,
      event: input.event,
      error_code: input.errorCode ?? null,
      reason: input.reason ?? null,
      payload: input.payload ? JSON.stringify(input.payload) : null,
      provider_event_id: input.providerEventId,
      occurred_at: input.occurredAt.toSQL(),
      created_at: DateTime.now().toSQL(),
      updated_at: DateTime.now().toSQL(),
    })
    .onConflict("provider_event_id")
    .ignore()
    .returning("id");
  if (inserted.length === 0) {
    return true;
  } // duplicate webhook delivery

  const statusMap = input.source === "twilio" ? TWILIO_STATUS_MAP : SENDGRID_EVENT_MAP;
  const newStatus = statusMap[input.event];
  if (newStatus && STATUS_RANK[newStatus] > STATUS_RANK[message.status]) {
    message.status = newStatus;
    message.statusDetail = input.reason ?? input.errorCode ?? null;
  }
  if (input.providerMessageId && !message.providerMessageId) {
    message.providerMessageId = input.providerMessageId;
  }
  await message.save();
  return true;
}

function toEventDto(event: MessageEvent): MessageEventDto {
  return {
    id: String(event.id),
    source: event.source,
    event: event.event,
    errorCode: event.errorCode,
    reason: event.reason,
    occurredAt: event.occurredAt.toISO() ?? "",
  };
}

function toEntryDto(message: Message): MessageLogEntryDto {
  return {
    id: message.id,
    channel: message.channel,
    recipient: message.recipient,
    messageType: message.messageType,
    regardingCustomerDetailsId: message.regardingCustomerDetailsId,
    subject: message.subject,
    smsBody: message.smsBody,
    templateId: message.templateId,
    status: message.status,
    statusDetail: message.statusDetail,
    sendoutId: message.sendoutId,
    sendoutName: message.sendout?.name ?? null,
    createdAt: message.createdAt?.toISO() ?? "",
    events: message.events
      .toSorted((a, b) => a.occurredAt.toMillis() - b.occurredAt.toMillis())
      .map(toEventDto),
  };
}

/**
 * All messages sent to the customer's *current* contact info — their own email and phone plus
 * their guardian's. Guardian recipients are shared between siblings by design.
 */
async function customerLog(detailsId: string): Promise<{
  entries: MessageLogEntryDto[];
  recipients: { email: string[]; phone: string[] };
}> {
  const customer = await StorageService.UserDetails.get(detailsId);
  const emails = [customer.email, customer.guardian?.email]
    .filter((email): email is string => (email?.length ?? 0) > 0)
    .map((email) => normalizeRecipient("email", email));
  const phones = [customer.phone, customer.guardian?.phone]
    .filter((phone): phone is string => (phone?.length ?? 0) > 0)
    .map((phone) => normalizeRecipient("sms", phone));
  const recipients = [...new Set([...emails, ...phones])];
  if (recipients.length === 0) {
    return { entries: [], recipients: { email: [], phone: [] } };
  }

  const messages = await Message.query()
    .whereIn("recipient", recipients)
    .preload("events")
    .preload("sendout")
    .orderBy("createdAt", "desc")
    .limit(200);
  return {
    entries: messages.map(toEntryDto),
    recipients: { email: [...new Set(emails)], phone: [...new Set(phones)] },
  };
}

/** Newest-first page of the global log for the live feed. */
async function feed(input: {
  limit: number;
  channel?: MessageChannel;
  sendoutId?: number;
  onlyFailures?: boolean;
  search?: string;
}): Promise<MessageLogEntryDto[]> {
  const query = Message.query()
    .preload("events")
    .preload("sendout")
    .orderBy("createdAt", "desc")
    .limit(input.limit);
  if (input.channel) {
    void query.where("channel", input.channel);
  }
  if (input.sendoutId) {
    void query.where("sendoutId", input.sendoutId);
  }
  if (input.onlyFailures) {
    void query.whereIn("status", [...FAILURE_MESSAGE_STATUSES]);
  }
  if (input.search) {
    // Escape LIKE wildcards so searching for e.g. "%" cannot match everything.
    const escaped = input.search.replaceAll(/[\\%_]/g, String.raw`\$&`);
    void query.whereILike("recipient", `%${escaped}%`);
  }
  const messages = await query;
  return messages.map(toEntryDto);
}

/** Metric days follow Norwegian local time, regardless of the server's clock (UTC on Railway). */
const METRICS_TIME_ZONE = "Europe/Oslo";

async function metrics(days: number): Promise<MessageLogMetricsDto> {
  const nowZoned = DateTime.now().setZone(METRICS_TIME_ZONE);
  const now = nowZoned.isValid ? nowZoned : DateTime.now();
  const since = now.minus({ days }).startOf("day");
  const last24h = now.minus({ hours: 24 });

  const [perDayRows, funnelRows, last24hRows] = await Promise.all([
    db
      .from("messages")
      .where("created_at", ">=", since.toSQL())
      .select(
        db.raw("to_char(created_at at time zone ?, 'YYYY-MM-DD') as day", [METRICS_TIME_ZONE]),
        "channel",
        db.raw("count(*) as total"),
        db.raw(
          `count(*) filter (where status in (${FAILURE_MESSAGE_STATUSES.map(() => "?").join(", ")})) as failures`,
          [...FAILURE_MESSAGE_STATUSES],
        ),
      )
      .groupByRaw("1, 2"),
    db
      .from("messages")
      .where("created_at", ">=", since.toSQL())
      .select("channel", "status", db.raw("count(*) as total"))
      .groupBy("channel", "status"),
    db
      .from("messages")
      .where("created_at", ">=", last24h.toSQL())
      .select(
        db.raw("count(*) as total"),
        db.raw(
          `count(*) filter (where status in (${FAILURE_MESSAGE_STATUSES.map(() => "?").join(", ")})) as failures`,
          [...FAILURE_MESSAGE_STATUSES],
        ),
      ),
  ]);

  const perDayByDate = new Map<string, { sms: number; email: number; failures: number }>();
  for (const row of perDayRows) {
    const date = String(row.day);
    const entry = perDayByDate.get(date) ?? { sms: 0, email: 0, failures: 0 };
    if (row.channel === "sms") {
      entry.sms += Number(row.total);
    }
    if (row.channel === "email") {
      entry.email += Number(row.total);
    }
    entry.failures += Number(row.failures);
    perDayByDate.set(date, entry);
  }
  const perDay = [];
  for (let day = since; day <= now; day = day.plus({ days: 1 })) {
    const date = day.toISODate() ?? "";
    perDay.push({ date, ...(perDayByDate.get(date) ?? { sms: 0, email: 0, failures: 0 }) });
  }

  const funnel: MessageLogMetricsDto["funnel"] = { sms: {}, email: {} };
  for (const row of funnelRows) {
    const channel = MESSAGE_CHANNELS.find((candidate) => candidate === row.channel);
    const status = MESSAGE_STATUSES.find((candidate) => candidate === row.status);
    if (!channel || !status) {
      continue;
    }
    funnel[channel][status] = Number(row.total);
  }

  return {
    perDay,
    funnel,
    failuresLast24h: Number(last24hRows[0]?.failures ?? 0),
    totalLast24h: Number(last24hRows[0]?.total ?? 0),
  };
}

/** Recent sendouts, newest first, each with message counts grouped by status. */
async function sendoutStats(limit: number): Promise<SendoutStatsDto[]> {
  const sendouts = await Sendout.query().orderBy("createdAt", "desc").limit(limit);
  if (sendouts.length === 0) {
    return [];
  }
  const countRows = await db
    .from("messages")
    .whereIn(
      "sendout_id",
      sendouts.map((sendout) => sendout.id),
    )
    .select("sendout_id", "status", db.raw("count(*) as total"))
    .groupBy("sendout_id", "status");

  const countsBySendout = new Map<number, Partial<Record<MessageStatus, number>>>();
  for (const row of countRows) {
    const status = MESSAGE_STATUSES.find((candidate) => candidate === row.status);
    if (!status) {
      continue;
    }
    const counts = countsBySendout.get(Number(row.sendout_id)) ?? {};
    counts[status] = Number(row.total);
    countsBySendout.set(Number(row.sendout_id), counts);
  }

  return sendouts.map((sendout) => {
    const statusCounts = countsBySendout.get(sendout.id) ?? {};
    return {
      id: sendout.id,
      kind: sendout.kind,
      name: sendout.name,
      createdAt: sendout.createdAt?.toISO() ?? "",
      messageCount: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
      statusCounts,
    };
  });
}

export const MessageLogService = {
  createSendout,
  logOutgoingMessage,
  recordSendResult,
  recordProviderEvent,
  customerLog,
  feed,
  metrics,
  sendoutStats,
  normalizeRecipient,
};
