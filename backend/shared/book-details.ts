import type { CustomerItemStatus } from "#shared/customer-item/actionable_customer_item";
import type { CustomerItemType } from "#shared/customer-item/customer-item-type";
import type { InvoiceStatus } from "#shared/invoice";
import type { OrderItemType } from "#shared/order/order-item/order-item-type";

/**
 * The invoice a book was last put on, for the badge on its row. Lines that were cancelled, and
 * invoices that were credited, do not count: the customer no longer owes anything for the book.
 */
export interface BookInvoiceSummary {
  id: string;
  invoiceNumber: string;
  status: Exclude<InvoiceStatus, "credit-note">;
}

/** Someone who gave the book to its holder. */
export type BookGiver =
  | { kind: "employee"; userId: string; name: string }
  /** The book came from another student through an overlevering. */
  | { kind: "peer"; userId: string | null; name: string };

export interface BookInvoiceEntry extends BookInvoiceSummary {
  /** `YYYY-MM-DD`. */
  dueDate: string;
  /** The line for this book, in NOK including VAT. */
  amount: number;
}

/** Everything shown when a handed-out (or earlier) book is opened. */
export interface CustomerItemDetails {
  kind: "customer-item";
  id: string;
  customerId: string | null;
  itemId: string;
  title: string;
  isbn: string | null;
  blid: string | null;
  type: CustomerItemType;
  status: CustomerItemStatus;
  /** `YYYY-MM-DD`. */
  deadline: string;
  branch: { id: string; name: string };
  handout: {
    /** ISO timestamp with second precision. */
    at: string;
    /** Null when unknown, and for customers when an employee handed the book out. */
    by: BookGiver | null;
  };
  /** How the loan ended, when it has. */
  ended: {
    kind: "returned" | "buyout" | "cancel" | "buyback";
    /** ISO timestamp with second precision; null on legacy rows. */
    at: string | null;
    branchName: string | null;
  } | null;
  invoices: BookInvoiceEntry[];
}

/** Everything shown when a book that is ordered but not yet handed out is opened. */
export interface OrderedItemDetails {
  kind: "ordered";
  orderId: string;
  customerId: string | null;
  itemId: string;
  title: string;
  isbn: string | null;
  type: OrderItemType;
  /** `YYYY-MM-DD`; null on a purchase. */
  deadline: string | null;
  branch: { id: string; name: string };
}

export type BookDetails = CustomerItemDetails | OrderedItemDetails;
