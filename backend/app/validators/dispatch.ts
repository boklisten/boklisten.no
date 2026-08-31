import vine from "@vinejs/vine";

import { emailField, phoneField } from "#validators/common/fields";
import { existingEmailTemplateId } from "#validators/common/rules";

export const sendgridEmailTemplatesResponseValidator = vine.create(
  vine.object({
    result: vine.array(
      vine.object({
        id: vine.string(),
        name: vine.string(),
      }),
    ),
  }),
);

export const createDispatchValidator = vine.create(
  vine.object({
    /** Human-readable label for the sendout in the message log, e.g. the email template name. */
    name: vine.string().maxLength(255).optional(),
    recipients: vine.array(
      vine.object({
        email: emailField.clone().optional().requiredIfExists("emailTemplateId"),
        phone: phoneField.clone().optional().requiredIfExists("smsText"),
        smsText: vine.string().minLength(3).maxLength(1600).optional(),
        emailTemplateId: vine.string().optional().use(existingEmailTemplateId()),
      }),
    ),
  }),
);
