import vine from "@vinejs/vine";

/**
 * Kept here rather than in `common/rules`: that module pulls in services which pull in validators
 * that import this file, and a cycle through it leaves the fields uninitialised on first load.
 */
const parsableDate = vine.createRule((value, options, field) => {
  if (typeof value !== "string") {
    return;
  }
  if (Number.isNaN(Date.parse(value))) {
    field.report(`${value} er ikke en gyldig dato`, "parsable_date", field);
  }
});

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
