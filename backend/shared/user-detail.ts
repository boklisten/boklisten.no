import type { BlDocument } from "#shared/bl-document";

export interface UserDetail extends BlDocument {
  name: string;
  email: string;
  phone: string;
  address: string;
  postCode: string;
  postCity: string;
  dob: Date;
  emailConfirmed: boolean;
  guardian?: {
    name: string;
    email: string;
    emailConfirmed?: boolean;
    phone: string;
    confirmed?: boolean;
  };
  orders?: string[];
  customerItems?: string[];
  blid: string;
  branchMembership?: string | undefined; // The branch the customer belongs to
  tasks?: {
    confirmDetails?: boolean;
    signAgreement?: boolean;
  };
}
