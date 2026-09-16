import vine from "@vinejs/vine";

import { emailField, phoneField, postalCodeField } from "#validators/common/fields";

export const companyValidator = vine.create(
  vine.object({
    name: vine.string().trim(),
    organizationNumber: vine.string().trim(),
    customerNumber: vine.string().trim(),
    phone: phoneField.clone(),
    email: emailField.clone(),
    address: vine.string().trim(),
    postCode: postalCodeField.clone(),
    postCity: vine.string().trim(),
  }),
);
