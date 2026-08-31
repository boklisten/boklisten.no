import type { HttpContext } from "@adonisjs/core/http";
import logger from "@adonisjs/core/services/logger";
import { DateTime } from "luxon";
import twilio from "twilio";

import { MessageLogService } from "#services/message_log_service";
import { verifySendgridSignature } from "#services/webhook_verification_service";
import env from "#start/env";
import { sendgridEventValidator, twilioSmsEventValidator } from "#validators/webhooks";

/**
 * Receives delivery/engagement events from the providers and appends them to the message log.
 * These routes are unauthenticated by necessity; authenticity is proven by provider signatures
 * instead (SendGrid: signed event webhook, Twilio: X-Twilio-Signature over the callback URL).
 */
export default class WebhooksController {
  /**
   * SendGrid Event Webhook: a JSON array of events. Both the staging and production webhooks
   * receive all account events, so each environment keeps only events whose `bl_api_env` custom
   * arg matches — the rest belong to the other environment's database.
   */
  async sendgridEvents(ctx: HttpContext) {
    const signature = ctx.request.header("x-twilio-email-event-webhook-signature");
    const timestamp = ctx.request.header("x-twilio-email-event-webhook-timestamp");
    const rawBody = ctx.request.raw();
    const publicKeyBase64 = env.get("SENDGRID_WEBHOOK_PUBLIC_KEY");
    if (!signature || !timestamp || !rawBody || !publicKeyBase64) {
      return ctx.response.forbidden({ error: "missing signature" });
    }
    if (!verifySendgridSignature({ publicKeyBase64, rawBody, signature, timestamp })) {
      return ctx.response.forbidden({ error: "invalid signature" });
    }

    const events = ctx.request.body();
    if (!Array.isArray(events)) {
      return ctx.response.badRequest({ error: "expected an array of events" });
    }

    for (const event of events) {
      try {
        const [, data] = await sendgridEventValidator.tryValidate(event);
        if (!data || data.bl_api_env !== env.get("API_ENV")) continue;

        await MessageLogService.recordProviderEvent({
          messageId: data.bl_message_id,
          source: "sendgrid",
          event: data.event,
          errorCode: data.status ?? null,
          reason: data.reason ?? null,
          payload: data,
          occurredAt: data.timestamp ? DateTime.fromSeconds(data.timestamp) : DateTime.now(),
          providerEventId: data.sg_event_id,
          providerMessageId: data.sg_message_id ?? null,
        });
      } catch (error) {
        // One broken event must not block the rest of the batch; SendGrid re-posts on non-2xx.
        logger.error(`failed to record SendGrid event: ${error}`);
      }
    }

    return { received: true };
  }

  /**
   * Twilio status callback for one SMS. The message log row id is baked into the callback URL
   * when the message is created, and Twilio signs its requests over that exact URL.
   */
  async twilioSmsEvent(ctx: HttpContext) {
    const messageId = ctx.request.param("messageId");
    const signature = ctx.request.header("x-twilio-signature");
    // Twilio signs over the exact form values it sent; the bodyparser's convertEmptyStringsToNull
    // must be undone or any empty parameter would break the signature.
    const body: Record<string, unknown> = ctx.request.body();
    const parameters = Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, value ?? ""]),
    );
    const url = `${env.get("BL_API_URI")}/webhooks/twilio/${messageId}`;
    if (
      !signature ||
      !twilio.validateRequest(env.get("TWILIO_SMS_AUTH_TOKEN"), signature, url, parameters)
    ) {
      return ctx.response.forbidden({ error: "invalid signature" });
    }

    const [validationError, data] = await twilioSmsEventValidator.tryValidate(parameters);
    if (validationError) {
      return ctx.response.badRequest({ error: "missing MessageSid or MessageStatus" });
    }

    await MessageLogService.recordProviderEvent({
      messageId,
      source: "twilio",
      event: data.MessageStatus,
      errorCode: data.ErrorCode || null,
      payload: data,
      occurredAt: DateTime.now(),
      // Twilio sends no event id; one status per message is enough to drop re-posts.
      providerEventId: `${data.MessageSid}:${data.MessageStatus}`,
      providerMessageId: data.MessageSid,
    });

    return { received: true };
  }
}
