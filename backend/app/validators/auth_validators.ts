import vine from "@vinejs/vine";

import { emailField, passwordField } from "#validators/common/fields";
import { uniqueEmail } from "#validators/common/rules";
import { userDetailsSchema } from "#validators/users";

export const forgotPasswordValidator = vine.create(
  vine.object({
    email: emailField.clone(),
  }),
);

export const passwordResetValidator = vine.create({
  params: vine.object({
    id: vine.string(),
  }),
  token: vine.string(),
  newPassword: passwordField.clone(),
});

export const registerSchema = vine.object({
  email: emailField.clone().use(uniqueEmail()),
  password: passwordField.clone(),
  ...userDetailsSchema.getProperties(),
});

export const registerValidator = vine.create(registerSchema);

export const localAuthValidator = vine.create(
  vine.object({
    username: vine.string(),
    password: vine.string(),
  }),
);

export const tokenValidator = vine.create(
  vine.object({
    refreshToken: vine.string().jwt(),
  }),
);
