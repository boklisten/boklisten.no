import vine from "@vinejs/vine";

import { existingEmailTemplateId } from "#validators/common/rules";

export const reminderValidator = vine.create(
  vine.object({
    deadlineISO: vine.string(),
    customerItemType: vine.enum(["partly-payment", "rent", "loan"]),
    branchIDs: vine.array(vine.string()),
    emailTemplateId: vine.string().use(existingEmailTemplateId()).nullable(),
    smsText: vine.string().minLength(3).maxLength(1600).nullable(),
  }),
);
