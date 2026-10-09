import vine from "@vinejs/vine";

import { emailField, phoneField, smsCodeField } from "#validators/common/fields";
import { uniqueEmail } from "#validators/common/rules";
import { ownUserFieldsSchema } from "#validators/users";

export const sendLoginCodeValidator = vine.create(
  vine.object({
    phone: phoneField.clone(),
  }),
);

export const verifyLoginCodeValidator = vine.create(
  vine.object({
    phone: phoneField.clone(),
    code: smsCodeField.clone(),
  }),
);

/** A sign-up after a login code proved a number no account has; the phone comes from the session. */
export const registerSchema = vine.object({
  email: emailField.clone().use(uniqueEmail()),
  ...ownUserFieldsSchema.getProperties(),
});

export const registerValidator = vine.create(registerSchema);
