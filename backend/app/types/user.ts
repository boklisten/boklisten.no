/** What the Vipps login driver hands back about the person who logged in. */
export interface VippsUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phoneNumber: string;
  phoneNumberVerified: boolean;
  address: string;
  postalCode: string;
  postalCity: string;
}
