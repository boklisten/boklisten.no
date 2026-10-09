/** A company we invoice by hand: a school or municipality buying books outright. */
export interface Company {
  id: string;
  name: string;
  /** Null on a few old companies we have no phone or email for; new ones must give both. */
  phone: string | null;
  email: string | null;
  address: string;
  postCode: string;
  /** The customer number in our accounting system; today always the organization number. */
  customerNumber: string;
  organizationNumber: string;
}
