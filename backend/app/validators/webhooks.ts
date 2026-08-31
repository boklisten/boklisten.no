import vine from "@vinejs/vine";

/**
 * One entry of SendGrid's event webhook batch. Unknown properties are kept so the stored payload
 * retains the full provider event. Validated per event: a malformed entry is skipped, never the
 * whole batch.
 */
export const sendgridEventValidator = vine.create(
  vine
    .object({
      bl_api_env: vine.string(),
      bl_message_id: vine.string().minLength(1),
      event: vine.string(),
      sg_event_id: vine.string(),
      sg_message_id: vine.string().optional(),
      status: vine.string().optional(),
      reason: vine.string().optional(),
      timestamp: vine.number().optional(),
    })
    .allowUnknownProperties(),
);

/** Twilio's SMS status callback form fields; unknown properties feed the stored payload. */
export const twilioSmsEventValidator = vine.create(
  vine
    .object({
      MessageSid: vine.string(),
      MessageStatus: vine.string(),
      ErrorCode: vine.string().optional(),
    })
    .allowUnknownProperties(),
);
