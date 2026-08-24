import vine from "@vinejs/vine";

import { emailField, phoneField, postalCodeField } from "#validators/common/fields";
import { uniqueEmail, uniquePhoneNumber } from "#validators/common/rules";
import { cleanUserInput } from "#validators/common/transformers";

// Legacy for bl-admin user detail patching
export const userDetailPatchValidator = vine.create(
  vine.object({
    name: vine
      .string()
      .optional()
      .transform((value) => cleanUserInput(value)),
    dob: vine.string().optional(),
    phone: vine.string().optional(),
    address: vine
      .string()
      .optional()
      .transform((value) => cleanUserInput(value)),
    postCity: vine
      .string()
      .optional()
      .transform((value) => cleanUserInput(value)),
    postCode: vine.string().optional(),
    branchMembership: vine.string().optional(),
    emailConfirmed: vine.boolean().optional(),
    guardian: vine.any().optional(),
  }),
);

// Only fields that customers are allowed to adjust after registration
const customerUpdateUserDetailsSchema = vine.object({
  phoneNumber: phoneField.clone().use(uniquePhoneNumber()),
  name: vine.string().transform((value) => cleanUserInput(value)),
  address: vine.string().transform((value) => cleanUserInput(value)),
  postalCode: postalCodeField.clone(),
  postalCity: vine.string(),
  dob: vine.date().before("today"),
  branchMembership: vine.string().nullable().optional(),
  guardian: vine
    .object({
      name: vine
        .string()
        .optional()
        .transform((value) => cleanUserInput(value)),
      email: emailField.clone().optional(),
      phone: phoneField.clone().optional(),
    })
    .optional(),
});

export const userDetailSearchValidator = vine.create({
  searchStr: vine.string(),
});

export const customerUpdateUserDetailsValidator = vine
  .withMetaData<{ detailsId: string }>()
  .create(customerUpdateUserDetailsSchema);

// Fields that employees are allowed to adjust
const employeeUpdateUserDetailsSchema = vine.object({
  ...customerUpdateUserDetailsSchema.getProperties(),
  email: emailField.clone().use(uniqueEmail()),
  emailVerified: vine.boolean(),
});

export const employeeUpdateUserDetailsValidator = vine
  .withMetaData<{ detailsId: string }>()
  .create(employeeUpdateUserDetailsSchema);
