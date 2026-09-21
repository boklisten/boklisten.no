import vine from "@vinejs/vine";

import { emailField, objectIdField, phoneField, postalCodeField } from "#validators/common/fields";
import { uniqueEmail, uniquePhoneNumber } from "#validators/common/rules";
import { cleanUserInput } from "#validators/common/transformers";

/**
 * The contact details a customer maintains themselves, named as the `User` DTO names them. Shared
 * by registration and both update endpoints; the guardian fields are only required (by
 * `invalidUserFields`) when the customer is underage.
 */
export const userDetailsSchema = vine.object({
  name: vine.string().transform((value) => cleanUserInput(value)),
  phone: phoneField.clone().use(uniquePhoneNumber()),
  address: vine.string().transform((value) => cleanUserInput(value)),
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

export const updateMeValidator = vine
  .withMetaData<{ detailsId: string }>()
  .create(userDetailsSchema);

/** Employees may also change the email and vouch for it. */
export const updateUserValidator = vine.withMetaData<{ detailsId: string }>().create(
  vine.object({
    ...userDetailsSchema.getProperties(),
    email: emailField.clone().use(uniqueEmail()),
    emailConfirmed: vine.boolean(),
  }),
);
