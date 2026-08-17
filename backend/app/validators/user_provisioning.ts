import vine from "@vinejs/vine";

import { emailField, phoneField, postalCodeField } from "#validators/common/fields";

export const userProvisioningValidator = vine.create(
  vine.object({
    userCandidates: vine.array(
      vine.object({
        name: vine.string().trim(),
        phone: phoneField.clone(),
        email: emailField.clone(),
        localName: vine.string().trim(),

        address: vine.string().optional(),
        postalCode: postalCodeField.clone().optional(),
        postalCity: vine.string().optional(),
        dob: vine.date().optional(),
      }),
    ),
    branchResolutions: vine
      .array(
        vine.object({
          localName: vine.string().trim(),
          branchId: vine.string(),
        }),
      )
      .optional(),
  }),
);
