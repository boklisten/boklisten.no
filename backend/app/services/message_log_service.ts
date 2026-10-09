import { randomUUID } from "node:crypto";

import logger from "@adonisjs/core/services/logger";
import db from "@adonisjs/lucid/services/db";
import { DateTime } from "luxon";

import BadRequestException from "#exceptions/bad_request_exception";
import Message from "#models/message";
import type MessageEvent from "#models/message_event";
import Sendout from "#models/sendout";
import User from "#models/user";
import type {
  MessageChannel,
  MessageEventDto,
  MessageLogEntryDto,
  MessageLogFeedPage,
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
  customerId?: string | null;
}

async function createSendout(input: {
  kind: SendoutKind;
  name?: string | null;
  initiatedById?: string | null;
}): Promise<Sendout | null> {
  try {
    return await Sendout.create({
      kind: input.kind,
      name: input.name ?? null,
      initiatedById: input.initiatedById ?? null,
    });
  } catch (error) {
    logger.error(`failed to create sendout: ${String(error)}`);
    return null;
  }
}

interface OutgoingMessage {
  channel: MessageChannel;
  recipient: string;
  context: MessageLogContext;
  subject?: string | null;
  smsBody?: string | null;
  templateId?: string | null;
  templateData?: Record<string, unknown>;
}

/**
 * Records outgoing messages before the provider is called. Logging must never break sending, so a
 * failure returns nulls and the send proceeds unlogged.
 */
async function logOutgoingMessages(inputs: OutgoingMessage[]): Promise<(Message | null)[]> {
  if (inputs.length === 0) {
    return [];
  }
  try {
    const rows: Record<string, unknown>[] = await db
      .table("messages")
      .multiInsert(
        inputs.map((input) => {
          const templateData = redactTemplateData(input.templateData);
          return {
            id: randomUUID(),
            channel: input.channel,
            recipient: normalizeRecipient(input.channel, input.recipient),
            message_type: input.context.messageType,
            sendout_id: input.context.sendoutId ?? null,
            customer_id: input.context.customerId ?? null,
            subject: input.subject ?? null,
            sms_body: input.smsBody ?? null,
            template_id: input.templateId ?? null,
            template_data: templateData ? JSON.stringify(templateData) : null,
            status: "created",
          };
        }),
      )
      .returning("*");
    return rows.map((row) => Message.$createFromAdapterResult(row));
  } catch (error) {
    logger.error(`failed to log ${inputs.length} outgoing message(s): ${String(error)}`);
    return inputs.map(() => null);
  }
}

async function logOutgoingMessage(input: OutgoingMessage): Promise<Message | null> {
  const [message] = await logOutgoingMessages([input]);
  return message ?? null;
}

/** Records the immediate outcome of handing the messages to the provider. */
async function recordSendResult(
  messages: (Pick<Message, "id"> | null)[],
  result: {
    status: "sent" | "send-failed" | "skipped";
    reason?: string;
    providerMessageId?: string;
  },
): Promise<void> {
  const ids = messages.flatMap((message) => (message ? [message.id] : []));
  if (ids.length === 0) {
    return;
  }
  const now = DateTime.now();
  try {
    await db.table("message_events").multiInsert(
      ids.map((id) => ({
        message_id: id,
        source: "internal",
        event: result.status,
        reason: result.reason ?? null,
        occurred_at: now.toSQL(),
      })),
    );
    await Message.query()
      .whereIn("id", ids)
      .update({
        status: result.status,
        statusDetail: result.reason ?? null,
        ...(result.providerMessageId ? { providerMessageId: result.providerMessageId } : {}),
        updatedAt: now,
      });
  } catch (error) {
    logger.error(`failed to record send result for ${ids.length} message(s): ${String(error)}`);
  }
}

interface ProviderEvent {
  messageId: string;
  source: "twilio" | "sendgrid";
  event: string;
  errorCode?: string | null;
  reason?: string | null;
  payload?: Record<string, unknown>;
  occurredAt: DateTime;
  providerEventId: string;
  providerMessageId?: string | null;
}

function statusRankSql(column: string) {
  const cases = Object.entries(STATUS_RANK).map(
    ([status, rank]) => `WHEN '${status}' THEN ${rank}`,
  );
  return `CASE ${column} ${cases.join(" ")} END`;
}

/**
 * Appends provider webhook events and advances each message's status when an event outranks the
 * current one. Duplicate deliveries are dropped on `provider_event_id`, events for unknown messages
 * (the other environment, deleted rows) are ignored. Returns how many events named a known message.
 */
async function recordProviderEvents(events: ProviderEvent[]): Promise<number> {
  const messageIds = [...new Set(events.map(({ messageId }) => messageId))];
  const known = new Set(
    (await db.from("messages").whereIn("id", messageIds).select("id")).map(
      (row: { id: string }) => row.id,
    ),
  );
  const recorded = events.filter(({ messageId }) => known.has(messageId));
  if (recorded.length === 0) {
    return 0;
  }

  const inserted: { provider_event_id: string }[] = await db
    .table("message_events")
    .multiInsert(
      recorded.map((event) => ({
        message_id: event.messageId,
        source: event.source,
        event: event.event,
        error_code: event.errorCode ?? null,
        reason: event.reason ?? null,
        payload: event.payload ? JSON.stringify(event.payload) : null,
        provider_event_id: event.providerEventId,
        occurred_at: event.occurredAt.toSQL(),
      })),
    )
    .onConflict("provider_event_id")
    .ignore()
    .returning("provider_event_id");
  const fresh = new Set(inserted.map((row) => row.provider_event_id));

  const updates = recorded
    .filter(({ providerEventId }) => fresh.has(providerEventId))
    .map((event) => ({
      id: event.messageId,
      status:
        (event.source === "twilio" ? TWILIO_STATUS_MAP : SENDGRID_EVENT_MAP)[event.event] ?? null,
      status_detail: event.reason ?? event.errorCode ?? null,
      provider_message_id: event.providerMessageId ?? null,
    }))
    .toSorted(
      (a, b) => (a.status ? STATUS_RANK[a.status] : -1) - (b.status ? STATUS_RANK[b.status] : -1),
    );
  // Postgres applies one row per target in an UPDATE ... FROM, so keep each message's top event.
  const byMessage = new Map(updates.map((update) => [update.id, update]));
  if (byMessage.size > 0) {
    const outranks = `v.status IS NOT NULL AND ${statusRankSql("v.status")} > ${statusRankSql("m.status")}`;
    await db.rawQuery(
      `UPDATE messages AS m SET
         status = CASE WHEN ${outranks} THEN v.status ELSE m.status END,
         status_detail = CASE WHEN ${outranks} THEN v.status_detail ELSE m.status_detail END,
         provider_message_id = COALESCE(m.provider_message_id, v.provider_message_id),
         updated_at = now()
       FROM json_to_recordset(?::json)
         AS v(id uuid, status text, status_detail text, provider_message_id text)
       WHERE m.id = v.id`,
      [JSON.stringify([...byMessage.values()])],
    );
  }
  return recorded.length;
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
    customerId: message.customerId,
    subject: message.subject,
    smsBody: message.smsBody,
    templateId: message.templateId,
    status: message.status,
    statusDetail: message.statusDetail,
    sendoutId: message.sendoutId,
    sendoutName: message.sendout?.name ?? null,
    createdAt: message.createdAt.toISO() ?? "",
    events: message.events
      .toSorted((a, b) => a.occurredAt.toMillis() - b.occurredAt.toMillis())
      .map(toEventDto),
  };
}

/**
 * All messages sent to the customer's *current* contact info — their own email and phone plus
 * their guardian's. Guardian recipients are shared between siblings by design.
 */
async function customerLog(userId: string): Promise<{
  entries: MessageLogEntryDto[];
  recipients: { email: string[]; phone: string[] };
}> {
  const customer = await User.findOrFail(userId);
  const emails = [customer.email, customer.guardianEmail]
    .filter((email): email is string => (email?.length ?? 0) > 0)
    .map((email) => normalizeRecipient("email", email));
  // Stored phones are already the eight digits the log keys SMS by (`users_phone_check`).
  const phones = [customer.phone, customer.guardianPhone].filter(
    (phone): phone is string => phone !== null,
  );
  const recipients = [...new Set([...emails, ...phones])];

  // Mail about the customer that went to someone else (an exception report to the office) belongs
  // in their log too, so the regarding-customer column is matched alongside the recipients.
  const aboutCustomer = Message.query().where("customerId", userId);
  const messages = await (
    recipients.length > 0 ? aboutCustomer.orWhereIn("recipient", recipients) : aboutCustomer
  )
    .preload("events")
    .preload("sendout")
    .orderBy("createdAt", "desc")
    .limit(200);
  return {
    entries: messages.map(toEntryDto),
    recipients: { email: [...new Set(emails)], phone: [...new Set(phones)] },
  };
}

/**
 * The feed walks `(created_at, id)` newest first. The cursor carries the timestamp as Postgres
 * prints it, so the microseconds `now()` stores survive the round trip; a millisecond ISO string
 * would skip or repeat rows written in the same millisecond, which a batch send always is.
 */
const CURSOR_SEPARATOR = "_";
const CURSOR_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?[+-]\d{2}(?::\d{2})?$/;
const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

function encodeFeedCursor(message: Message): string {
  return `${String(message.$extras["created_at_text"])}${CURSOR_SEPARATOR}${message.id}`;
}

function decodeFeedCursor(cursor: string): { createdAt: string; id: string } {
  const separator = cursor.lastIndexOf(CURSOR_SEPARATOR);
  const createdAt = cursor.slice(0, separator);
  const id = cursor.slice(separator + 1);
  if (separator === -1 || !CURSOR_TIMESTAMP_PATTERN.test(createdAt) || !UUID_PATTERN.test(id)) {
    throw new BadRequestException("Ugyldig posisjon i loggen");
  }
  return { createdAt, id };
}

/** One page of the global log for the live feed, newest first, strictly older than the cursor. */
async function feed(input: {
  limit: number;
  channel?: MessageChannel;
  sendoutId?: number;
  onlyFailures?: boolean;
  search?: string;
  cursor?: string;
}): Promise<MessageLogFeedPage> {
  const query = Message.query()
    .select("messages.*", db.raw("created_at::text as created_at_text"))
    .preload("events")
    .preload("sendout")
    .orderBy("createdAt", "desc")
    .orderBy("id", "desc")
    // One row more than the page, to know whether there is a next page
    .limit(input.limit + 1);
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
  if (input.cursor) {
    const cursor = decodeFeedCursor(input.cursor);
    void query.whereRaw("(created_at, id) < (?::timestamptz, ?::uuid)", [
      cursor.createdAt,
      cursor.id,
    ]);
  }
  const messages = await query;
  const page = messages.slice(0, input.limit);
  const last = page.at(-1);
  return {
    entries: page.map(toEntryDto),
    nextCursor: messages.length > input.limit && last !== undefined ? encodeFeedCursor(last) : null,
  };
}

async function metrics(days: number): Promise<MessageLogMetricsDto> {
  const now = DateTime.now();
  const since = now.minus({ days }).startOf("day");
  const last24h = now.minus({ hours: 24 });

  const [perDayRows, funnelRows, last24hRows] = await Promise.all([
    db
      .from("messages")
      .where("created_at", ">=", since.toSQL())
      .select(
        db.raw("to_char(created_at at time zone ?, 'YYYY-MM-DD') as day", [now.zoneName]),
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
      createdAt: sendout.createdAt.toISO() ?? "",
      messageCount: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
      statusCounts,
    };
  });
}

export const MessageLogService = {
  createSendout,
  logOutgoingMessage,
  logOutgoingMessages,
  recordSendResult,
  recordProviderEvents,
  customerLog,
  feed,
  metrics,
  sendoutStats,
};
