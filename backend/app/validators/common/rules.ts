import vine from "@vinejs/vine";

import User from "#models/user";
import DispatchService from "#services/dispatch_service";
import { EMAIL_TEMPLATES } from "#types/email_templates";

export const uniqueEmail = vine.createRule(async (value, options, field) => {
  if (typeof value !== "string") {
    return;
  }
  const existingUser = await User.byEmail(value);
  const userId: string | null = field.meta["userId"] ?? null;
  if (existingUser?.id === userId) {
    return;
  }

  if (existingUser) {
    field.report(
      `Det eksisterer allerede en konto med e-postadressen ${value}`,
      "unique_email",
      field,
    );
  }
});

export const uniquePhoneNumber = vine.createRule(async (value, options, field) => {
  if (typeof value !== "string") {
    return;
  }
  const existingUser = await User.byPhone(value);
  const userId: string | null = field.meta["userId"] ?? null;
  if (existingUser?.id === userId) {
    return;
  }

  if (existingUser) {
    field.report(
      `Det eksisterer allerede en konto med telefonnummeret ${value}`,
      "unique_phone",
      field,
    );
  }
});

export const existingEmailTemplateId = vine.createRule(async (value, options, field) => {
  if (typeof value !== "string") {
    return;
  }
  const allowedTemplates = (await DispatchService.getEmailTemplates()).filter(
    (emailTemplate) =>
      !Object.values(EMAIL_TEMPLATES).some(
        (transactionalTemplate) => transactionalTemplate.templateId === emailTemplate.id,
      ),
  );
  if (!allowedTemplates.some((template) => template.id === value)) {
    field.report(
      `Det eksisterer ingen e-postmal med ID ${value}`,
      "valid_email_template_id",
      field,
    );
  }
});
