export const MESSAGE_CHANNELS = ["sms", "email"] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export const MESSAGE_TYPES = [
  "reminder",
  "custom",
  "match-notify",
  "receipt",
  "signature",
  "delivery-info",
  "password-reset",
  "email-verification",
  "onboarding",
  "exception-report",
  "bokflyt-contact",
] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const SENDOUT_KINDS = ["reminder", "custom", "match-notify"] as const;
export type SendoutKind = (typeof SENDOUT_KINDS)[number];

/**
 * Denormalized "latest known" status of a message, advanced by internal send results and provider
 * events. `skipped` marks sends suppressed outside production (only employees receive real
 * messages there). `spam` is a spam report — the message was delivered, but flagged.
 */
export const MESSAGE_STATUSES = [
  "created",
  "skipped",
  "sent",
  "send-failed",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "failed",
  "spam",
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const FAILURE_MESSAGE_STATUSES = [
  "send-failed",
  "bounced",
  "failed",
  "spam",
] as const satisfies readonly MessageStatus[];

export function isFailureStatus(status: MessageStatus): boolean {
  return (FAILURE_MESSAGE_STATUSES as readonly MessageStatus[]).includes(status);
}

export const MESSAGE_EVENT_SOURCES = ["internal", "twilio", "sendgrid"] as const;
export type MessageEventSource = (typeof MESSAGE_EVENT_SOURCES)[number];

export interface MessageEventDto {
  id: string;
  source: MessageEventSource;
  event: string;
  errorCode: string | null;
  reason: string | null;
  occurredAt: string;
}

export interface MessageLogEntryDto {
  id: string;
  channel: MessageChannel;
  recipient: string;
  messageType: MessageType;
  regardingCustomerDetailsId: string | null;
  subject: string | null;
  smsBody: string | null;
  templateId: string | null;
  status: MessageStatus;
  statusDetail: string | null;
  sendoutId: number | null;
  sendoutName: string | null;
  createdAt: string;
  events: MessageEventDto[];
}

export interface SendoutStatsDto {
  id: number;
  kind: SendoutKind;
  name: string | null;
  createdAt: string;
  messageCount: number;
  statusCounts: Partial<Record<MessageStatus, number>>;
}

export interface MessageLogMetricsDto {
  /** One entry per day in the period, oldest first; days without messages included with zeroes. */
  perDay: {
    date: string;
    sms: number;
    email: number;
    failures: number;
  }[];
  /** Message counts by channel and status over the whole period, for the delivery funnel. */
  funnel: Record<MessageChannel, Partial<Record<MessageStatus, number>>>;
  failuresLast24h: number;
  totalLast24h: number;
}
