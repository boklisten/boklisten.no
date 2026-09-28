import type { DateTime } from "luxon";

import { isUnderage } from "#models/signature";

/** The columns the completeness check reads; the `User` model satisfies it. */
export interface UserFields {
  name: string;
  address: string;
  postCode: string;
  postCity: string;
  phone: string | null;
  dob: DateTime | null;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
}

/**
 * Which of the details the site needs are still missing. An underage customer must also name a
 * guardian, who signs the loan agreement and receives the reminders.
 */
export function invalidUserFields(user: UserFields): string[] {
  const invalidFields: string[] = [];
  for (const field of ["name", "address", "postCode", "postCity", "phone"] as const) {
    if (!user[field]) {
      invalidFields.push(field);
    }
  }
  if (user.dob === null) {
    invalidFields.push("dob");
  } else if (isUnderage(user)) {
    for (const field of ["guardianName", "guardianEmail", "guardianPhone"] as const) {
      if (!user[field]) {
        invalidFields.push(field);
      }
    }
  }
  return invalidFields;
}
