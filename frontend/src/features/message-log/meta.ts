import type {
  MessageChannel,
  MessageStatus,
  MessageType,
} from "@boklisten/backend/shared/message-log";

/**
 * Status semantics shared by every message log surface: teal/green shades mean the message got
 * through, blue means underway, red means it needs attention, orange is delivered-but-flagged,
 * gray is neutral. These are status colors — chart series use separate categorical colors.
 */
export const STATUS_META: Record<MessageStatus, { label: string; color: string }> = {
  created: { label: "Opprettet", color: "gray" },
  skipped: { label: "Ikke sendt (test)", color: "gray" },
  sent: { label: "Sendt", color: "blue" },
  delivered: { label: "Levert", color: "teal" },
  opened: { label: "Åpnet", color: "green" },
  clicked: { label: "Klikket", color: "green" },
  "send-failed": { label: "Sending feilet", color: "red" },
  failed: { label: "Ikke levert", color: "red" },
  bounced: { label: "Avvist", color: "red" },
  spam: { label: "Merket som spam", color: "orange" },
};

export const TYPE_LABELS: Record<MessageType, string> = {
  reminder: "Påminnelse",
  custom: "Utsendelse",
  "match-notify": "Overleveringsvarsel",
  receipt: "Kvittering",
  signature: "Signering",
  "delivery-info": "Levering",
  "password-reset": "Passordtilbakestilling",
  "email-verification": "E-postbekreftelse",
  onboarding: "Velkomstmelding",
  "exception-report": "Unntaksmelding",
  "bokflyt-contact": "Bokflyt-henvendelse",
};

export const CHANNEL_LABELS: Record<MessageChannel, string> = {
  sms: "SMS",
  email: "E-post",
};

/** Norwegian labels for the raw provider event trail. Unknown events fall back to the raw name. */
const EVENT_LABELS: Record<string, string> = {
  sent: "Sendt til leverandør",
  "send-failed": "Sending feilet",
  skipped: "Ikke sendt (test)",
  queued: "I kø hos Twilio",
  sending: "Sendes",
  delivered: "Levert",
  undelivered: "Ikke levert",
  failed: "Feilet",
  read: "Lest",
  processed: "Behandlet av SendGrid",
  deferred: "Utsatt av mottakerserver",
  open: "Åpnet",
  click: "Klikket på lenke",
  bounce: "Avvist av mottakerserver",
  dropped: "Droppet av SendGrid",
  spamreport: "Merket som spam",
  unsubscribe: "Avmeldt",
  group_unsubscribe: "Avmeldt",
  group_resubscribe: "Påmeldt igjen",
};

export function eventLabel(event: string): string {
  return EVENT_LABELS[event] ?? event;
}

/** Mirrors the backend's recipient normalization so contact info can be matched to log entries. */
export function normalizeRecipient(channel: MessageChannel, recipient: string): string {
  if (channel === "email") {
    return recipient.trim().toLowerCase();
  }
  const digits = recipient.replaceAll(/\D/g, "");
  return digits.length === 10 && digits.startsWith("47") ? digits.slice(2) : digits;
}
