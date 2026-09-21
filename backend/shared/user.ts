import type { UserPermission } from "#shared/user-permission";

/**
 * A user of the site: a customer, or an employee with a permission above customer. This is the
 * API shape of a row in the `users` table (the former `userdetails` merged with `users`), as
 * `User.toDto()` produces it; login credentials never leave the backend.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  /** Eight digits, or null when the user has not given one. */
  phone: string | null;
  address: string;
  postCode: string;
  postCity: string;
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
  createdAt: Date;
}
