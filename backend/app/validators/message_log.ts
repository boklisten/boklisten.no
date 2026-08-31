import vine from "@vinejs/vine";

import { MESSAGE_CHANNELS } from "#shared/message-log";

export const messageLogFeedValidator = vine.create(
  vine.object({
    limit: vine.number().min(1).max(200).optional(),
    channel: vine.enum(MESSAGE_CHANNELS).optional(),
    sendoutId: vine.number().optional(),
    onlyFailures: vine.boolean().optional(),
    search: vine.string().trim().maxLength(100).optional(),
  }),
);

export const messageLogMetricsValidator = vine.create(
  vine.object({
    days: vine.number().min(1).max(365).optional(),
  }),
);
