export interface DeliveryInfoBring {
  // amount/product are missing on pre-2020 documents and when legacy bl-admin's
  // tracking-number flow stores info without a successful Bring API regeneration
  amount?: number;
  // null is written by legacy bl-admin's tracking-number flow
  estimatedDelivery?: Date | null;
  facilityAddress: {
    address: string;
    postalCode: string;
    postalCity: string;
  };
  shipmentAddress?: {
    name: string;
    address: string;
    postalCode: string;
    postalCity: string;
  };
  trackingNumber?: string;
  from: string;
  to?: string;
  product?: "3584" | "SERVICEPAKKE";
}
