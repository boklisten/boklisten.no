import vine from "@vinejs/vine";

import {
  emailField,
  objectIdField,
  phoneField,
  postalCodeField,
  smsCodeField,
} from "#validators/common/fields";
import { uniqueEmail, uniquePhoneNumber } from "#validators/common/rules";
import { cleanUserInput } from "#validators/common/transformers";

/** Something `cleanUserInput` keeps; separators alone would clean to `''`, which the database rejects. */
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * The contact details a customer maintains themselves, named as the `User` DTO names them. Shared
 * by registration and both update endpoints; the guardian fields are only required (by
 * `invalidUserFields`) when the customer is underage. The phone is left out: customers change it
 * only with a code (`UsersController.changeMyPhone`).
 */
export const ownUserFieldsSchema = vine.object({
  name: vine
    .string()
    .regex(HAS_LETTER_OR_DIGIT)
    .transform((value) => cleanUserInput(value)),
  address: vine
    .string()
    .regex(HAS_LETTER_OR_DIGIT)
    .transform((value) => cleanUserInput(value)),
  postCode: postalCodeField.clone(),
  postCity: vine.string(),
  dob: vine.date().before("today"),
  branchMembershipId: objectIdField.clone().nullable().optional(),
  guardianName: vine
    .string()
    .nullable()
    .optional()
    .transform((value) => (value ? cleanUserInput(value) : null)),
  guardianEmail: emailField.clone().nullable().optional(),
  guardianPhone: phoneField.clone().nullable().optional(),
});

export const userFieldsSchema = vine.object({
  ...ownUserFieldsSchema.getProperties(),
  phone: phoneField.clone().use(uniquePhoneNumber()),
});

export const userSearchValidator = vine.create(
  vine.object({
    q: vine.string().trim(),
  }),
);

/** The user's own details; a changed email starts unconfirmed (see `UserService.updateOwnDetails`). */
export const updateMeValidator = vine.withMetaData<{ userId: string }>().create(
  vine.object({
    ...ownUserFieldsSchema.getProperties(),
    email: emailField.clone().use(uniqueEmail()),
  }),
);

/** Employees may also change the email and vouch for it. */
export const updateUserValidator = vine.withMetaData<{ userId: string }>().create(
  vine.object({
    ...userFieldsSchema.getProperties(),
    email: emailField.clone().use(uniqueEmail()),
    emailConfirmed: vine.boolean(),
  }),
);

export const phoneChangeCodeValidator = vine.withMetaData<{ userId: string }>().create(
  vine.object({
    phone: phoneField.clone().use(uniquePhoneNumber()),
  }),
);

export const phoneChangeValidator = vine.withMetaData<{ userId: string }>().create(
  vine.object({
    phone: phoneField.clone().use(uniquePhoneNumber()),
    code: smsCodeField.clone(),
  }),
);

export const smsLoginValidator = vine.create(
  vine.object({
    enabled: vine.boolean(),
  }),
);
