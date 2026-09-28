import vine from "@vinejs/vine";

import { existingEmailTemplateId } from "#validators/common/rules";
import { calendarDateField } from "#validators/common/fields";

export const reminderValidator = vine.create(
  vine.object({
    deadline: calendarDateField.clone(),
    customerItemType: vine.enum(["partly-payment", "rent"]),
    branchIDs: vine.array(vine.string()),
    emailTemplateId: vine.string().use(existingEmailTemplateId()).nullable(),
    smsText: vine.string().minLength(3).maxLength(1600).nullable(),
  }),
);
