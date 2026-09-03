import vine from "@vinejs/vine";

import { emailField, phoneField } from "#validators/common/fields";

export const bokflytContactValidator = vine.create(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(120),
    school: vine.string().trim().minLength(2).maxLength(160),
    email: emailField.clone(),
    phone: phoneField.clone(),
    message: vine.string().trim().maxLength(3000).optional(),
  }),
);
