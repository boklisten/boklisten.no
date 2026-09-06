import vine from "@vinejs/vine";

import { EMAIL_VALIDATION_SOURCES } from "#shared/email_validation";
import { emailField } from "#validators/common/fields";

export const emailValidationValidator = vine.create(
  vine.object({
    email: emailField.clone(),
    source: vine.enum(EMAIL_VALIDATION_SOURCES),
  }),
);

/** The subset of SendGrid's `POST /v3/validations/email` response the service reads. */
export const sendgridEmailValidationResponseValidator = vine.create(
  vine.object({
    result: vine.object({
      verdict: vine.enum(["Valid", "Risky", "Invalid"] as const),
      local: vine.string(),
      suggestion: vine.string().optional(),
      checks: vine.object({
        domain: vine.object({
          has_valid_address_syntax: vine.boolean(),
          has_mx_or_a_record: vine.boolean(),
          is_suspected_disposable_address: vine.boolean(),
        }),
        local_part: vine.object({
          is_suspected_role_address: vine.boolean(),
        }),
        additional: vine.object({
          has_known_bounces: vine.boolean(),
          has_suspected_bounces: vine.boolean(),
        }),
      }),
    }),
  }),
);
