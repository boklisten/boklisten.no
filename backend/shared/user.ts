import type { UserPermission } from "#shared/user-permission";

/**
 * A user of the site: a customer, or an employee with a permission above customer. This is the
 * API shape of a row in the `users` table (the former `userdetails` merged with `users`), as
 * `User.toDto()` produces it; login credentials never leave the backend.
 */
export interface User {
  id: string;
  /** The contact fields are null until the user gives them; `taskConfirmDetails` asks for them. */
  name: string | null;
  email: string;
  /** Eight digits, or null when the user has not given one. */
  phone: string | null;
  address: string | null;
  postCode: string | null;
  postCity: string | null;
  emailConfirmed: boolean;
  /** Calendar date, `yyyy-MM-dd`. */
  dob: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  /** The branch (class, year group or school) the customer belongs to. */
  branchMembershipId: string | null;
  /** The customer must confirm or complete their contact details before using the site. */
  taskConfirmDetails: boolean;
  /** The customer (or their guardian) must sign the loan agreement before using the site. */
  taskSignAgreement: boolean;
  permission: UserPermission;
  /** Whether a code by SMS may log in to the account; the user turns it off in their settings. */
  smsLoginEnabled: boolean;
  /** Whether the user has logged in with Vipps, which they need before turning SMS login off. */
  vippsLinked: boolean;
  createdAt: Date;
}
