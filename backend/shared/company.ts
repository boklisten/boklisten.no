/** A company we invoice by hand: a school or municipality buying books outright. */
export interface Company {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  postCode: string;
  postCity: string;
  /** The customer number in our accounting system; today always the organization number. */
  customerNumber: string;
  organizationNumber: string;
}
