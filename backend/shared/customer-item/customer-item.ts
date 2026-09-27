import type { CustomerItemType } from "#shared/customer-item/customer-item-type";
import type { Period } from "#shared/period";

/**
 * A book a customer holds or has held, either rented or partly paid for, from its handout until it
 * is returned, bought out, cancelled or bought back. Plain-data form of `app/models/customer_item.ts`.
 */
export interface CustomerItem {
  id: string;
  itemId: string;
  /** Unique id (sticker) of the copy; null on legacy loans handed out without one. */
  blid: string | null;
  type: CustomerItemType;
  /** Null once the customer's account has been deleted. */
  customerId: string | null;
  /** When the book must be returned (or, for a partly payment, bought out). */
  deadline: Date;

  handoutBranchId: string;
  handoutEmployeeId: string | null;
  handedOutAt: Date;

  returned: boolean;
  returnBranchId: string | null;
  returnEmployeeId: string | null;
  returnedAt: Date | null;

  buyout: boolean;
  buyoutOrderId: string | null;
  boughtOutAt: Date | null;

  cancel: boolean;
  cancelOrderId: string | null;
  cancelledAt: Date | null;

  buyback: boolean;
  buybackOrderId: string | null;
  boughtBackAt: Date | null;

  /** Partly payment: what the customer still owes on a buyout. */
  amountLeftToPay: number | null;

  /** Deadline extensions, oldest first. */
  periodExtends: {
    /** The deadline before the extension. */
    periodFrom: Date;
    /** The new deadline. */
    periodTo: Date;
    periodType: Period;
    /** When the extension was bought. */
    createdAt: Date;
  }[];

  createdAt: Date;
  updatedAt: Date;
}
