import vine from "@vinejs/vine";

import DispatchService from "#services/dispatch_service";
import { UserDetailService } from "#services/user_detail_service";
import { EMAIL_TEMPLATES } from "#types/email_templates";

export const parsableDate = vine.createRule((value, options, field) => {
  if (typeof value !== "string") {
    return;
  }
  if (Number.isNaN(Date.parse(value))) {
    field.report(`${value} er ikke en gyldig dato`, "parsable_date", field);
  }
});

export const uniqueEmail = vine.createRule(async (value, options, field) => {
  if (typeof value !== "string") {
    return;
  }
  const foundUserDetail = await UserDetailService.getByEmail(value);
  const detailsId: string | null = field.meta["detailsId"] ?? null;
  if (foundUserDetail?.id === detailsId) {
    return;
  }

  if (foundUserDetail) {
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
  const foundUserDetail = await UserDetailService.getByPhoneNumber(value);
  const detailsId: string | null = field.meta["detailsId"] ?? null;
  if (foundUserDetail?.id === detailsId) {
    return;
  }

  if (foundUserDetail) {
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
