import type { OrderItemType } from "#shared/order/order-item/order-item-type";
import type { PaymentMethod } from "#shared/payment/payment-method/payment-method";
import type { Period } from "#shared/period";

/**
 * Derived from the order amount and its payments, not stored. Invoice-paid orders carry an
 * amount but no payment document, and legacy gateway payments are often flagged unconfirmed
 * even though the order went through, so coverage counts every payment regardless of the flag.
 */
export type OrderPaymentStatus = "paid" | "unpaid" | "refunded" | "free" | "invoice";

export interface OrderHistoryParty {
  userId: string;
  name: string;
}

/** The other student in a match transfer, when it can be told. */
export interface OrderHistoryTransfer {
  direction: "received" | "delivered";
  /** null on legacy one-sided match orders where no counterpart could be paired. */
  counterparty: OrderHistoryParty | null;
  /** ISO timestamp: the handover when one was recorded, otherwise the order time. */
  time: string;
}

export interface OrderHistoryItem {
  type: OrderItemType;
  typeLabel: string;
  itemId: string;
  title: string;
  isbn: string | null;
  blid: string | null;
  amount: number;
  unitPrice: number;
  /**
   * The rental/partly-payment period, for the item types that carry one. `from` is an ISO
   * timestamp, `to` the deadline (`YYYY-MM-DD`).
   */
  period: { from: string | null; to: string; periodType: Period | null } | null;
  amountLeftToPay: number | null;
  buybackAmount: number | null;
  customerItemId: string | null;
  handout: boolean;
  delivered: boolean;
  movedToOrderId: string | null;
  movedFromOrderId: string | null;
  transfer: OrderHistoryTransfer | null;
}

export interface OrderHistoryPayment {
  id: string;
  method: PaymentMethod;
  methodLabel: string;
  amount: number;
  confirmed: boolean;
  /** ISO timestamp. */
  time: string;
}

export type OrderHistoryDelivery =
  | { method: "branch"; branchName: string | null }
  | {
      method: "bring";
      trackingNumber: string | null;
      /** ISO timestamp. */
      estimatedDelivery: string | null;
      shipmentAddress: {
        name: string;
        address: string;
        postalCode: string;
      } | null;
      /** "pakke i postkassen" vs "pakke til hentested"; null when the product is unknown. */
      productLabel: string | null;
      amount: number;
    };

export interface OrderHistoryEntry {
  id: string;
  /** ISO timestamp. */
  creationTime: string;
  branch: { id: string; name: string };
  amount: number;
  byCustomer: boolean;
  /** Absent for the customer audience, and when no employee was recorded. */
  employee: OrderHistoryParty | null;
  /** True when the order was placed with e-mail notification switched off. Staff only. */
  emailSuppressed: boolean;
  /** Vipps Checkout session state, present only on online checkout orders. Staff only. */
  checkoutState: string | null;
  paymentStatus: OrderPaymentStatus;
  payments: OrderHistoryPayment[];
  delivery: OrderHistoryDelivery | null;
  items: OrderHistoryItem[];
}
