import vine from "@vinejs/vine";
import { DateTime } from "luxon";

import { isNorwegianMobile, phoneDigits } from "#shared/phone_number";

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

/**
 * The regex only pins the shape; `2026-02-30` fits it, and `Date.parse` quietly rolls such dates
 * into March. Luxon is the one that actually refuses a day that does not exist.
 */
const realCalendarDate = vine.createRule((value, _options, field) => {
  if (typeof value !== "string") {
    return;
  }
  if (!DateTime.fromISO(value).isValid) {
    field.report(`${value} er ikke en gyldig dato`, "real_calendar_date", field);
  }
});

/**
 * A Norwegian mobile number, stored as its eight digits. A `+47`/`0047` prefix and inner spaces
 * are stripped rather than rejected, so the database never sees the same number in two spellings
 * (the unique index on phones compares the digits).
 */
const norwegianMobile = vine.createRule((value, _options, field) => {
  if (typeof value !== "string") {
    return;
  }
  const digits = phoneDigits(value);
  if (!isNorwegianMobile(digits)) {
    field.report("{{ field }} må være et norsk mobilnummer på åtte siffer", "mobile", field);
    return;
  }
  field.mutate(digits, field);
});

export const emailField = vine.string().trim().toLowerCase().email();
export const objectIdField = vine.string().regex(/^[\da-f]{24}$/i);
export const dateStringField = vine.string().use(parsableDate());
/** A calendar day such as a deadline, `YYYY-MM-DD`. */
export const calendarDateField = vine
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .use(realCalendarDate());
export const phoneField = vine.string().trim().use(norwegianMobile());
/** A one-time code from an SMS (`SmsCodeService`). */
export const smsCodeField = vine
  .string()
  .trim()
  .regex(/^\d{6}$/);
export const postalCodeField = vine.string().postalCode({ countryCode: ["NO"] });
export const percentageField = vine.number().min(0).max(1);
