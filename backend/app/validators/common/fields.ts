import vine from "@vinejs/vine";

import { parsableDate } from "#validators/common/rules";

export const emailField = vine.string().trim().toLowerCase().email();
export const objectIdField = vine.string().regex(/^[\da-f]{24}$/i);
export const dateStringField = vine.string().use(parsableDate());
export const phoneField = vine
  .string()
  .trim()
  .mobile({ locale: ["nb-NO"] });
export const passwordField = vine.string().minLength(10).maxLength(256);
export const postalCodeField = vine.string().postalCode({ countryCode: ["NO"] });
export const percentageField = vine.number().min(0).max(1);
