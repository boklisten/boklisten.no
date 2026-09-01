import type { BlDocument } from "#shared/bl-document";

export interface Company extends BlDocument {
  name: string;
  contactInfo: {
    phone: string;
    email: string;
    address: string;
    postCode: string;
    postCity: string;
  };
  customerNumber?: string;
  organizationNumber?: string;
}
