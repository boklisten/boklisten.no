import vine from "@vinejs/vine";

import { emailField, objectIdField, phoneField, postalCodeField } from "#validators/common/fields";
import { uniqueEmail, uniquePhoneNumber } from "#validators/common/rules";
import { cleanUserInput } from "#validators/common/transformers";

/**
 * The contact details a customer maintains themselves, named as the `User` DTO names them. Shared
 * by registration and both update endpoints; the guardian fields are only required (by
 * `invalidUserFields`) when the customer is underage.
 */
/** Something `cleanUserInput` keeps; separators alone would clean to `''`, which the database rejects. */
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

export const userFieldsSchema = vine.object({
  name: vine
    .string()
    .regex(HAS_LETTER_OR_DIGIT)
    .transform((value) => cleanUserInput(value)),
  phone: phoneField.clone().use(uniquePhoneNumber()),
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

export const userSearchValidator = vine.create(
  vine.object({
    q: vine.string().trim(),
  }),
);

export const updateMeValidator = vine.withMetaData<{ userId: string }>().create(userFieldsSchema);

/** Employees may also change the email and vouch for it. */
export const updateUserValidator = vine.withMetaData<{ userId: string }>().create(
  vine.object({
    ...userFieldsSchema.getProperties(),
    email: emailField.clone().use(uniqueEmail()),
    emailConfirmed: vine.boolean(),
  }),
);
