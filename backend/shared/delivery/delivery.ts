import type { DeliveryMethod } from "#shared/delivery/delivery-method/delivery-method";

/** Bring product codes: 3584 is a mailbox parcel, SERVICEPAKKE goes to a pickup point. */
export type BringProduct = "3584" | "SERVICEPAKKE";

/**
 * How an order reaches the customer: picked up at a branch (`branchId`) or shipped with Bring (the
 * rest, all present on every shipment except the estimate, the product and the tracking number).
 */
export interface Delivery {
  id: string;
  orderId: string;
  method: DeliveryMethod;
  /** What the customer paid for the delivery; 0 when the branch covers it. */
  amount: number;
  branchId: string | null;
  /** What Bring charges for the shipment. */
  bringAmount: number | null;
  estimatedDelivery: Date | null;
  facilityAddress: string | null;
  facilityPostalCode: string | null;
  facilityPostalCity: string | null;
  shipmentName: string | null;
  shipmentAddress: string | null;
  shipmentPostalCode: string | null;
  shipmentPostalCity: string | null;
  fromPostalCode: string | null;
  toPostalCode: string | null;
  product: BringProduct | null;
  trackingNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
}
