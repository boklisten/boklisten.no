/**
 * DTOs for the "Hurtiginnsamling" (bulk collection) feature, where a stand employee scans the
 * BL-IDs of books that customers are returning and then delivers (collects) them.
 *
 * Deadlines are ISO date strings; the frontend formats them and decides whether they are overdue.
 */

/** A single book resolved from a scanned BL-ID, shown as a row in the to-deliver list. */
export interface ScannedBook {
  customerItemId: string;
  blid: string;
  item: string;
  title: string;
  /** Name of the branch where the book was originally handed out. */
  handoutBranchName: string;
  /** ISO date string. */
  deadline: string;
  customerId: string;
  /** Name of the customer who currently possesses the book. */
  customerName: string;
  /** Whether the book is locked to a UserMatch and therefore cannot be collected at a stand. */
  lockedToMatch: boolean;
}

/** A book that was collected in the current session, shown in the receipt. */
export interface CollectedBook {
  title: string;
  /** ISO date string of the rental deadline. */
  deadline: string;
  /** Time of collection, formatted hh:mm:ss. */
  time: string;
  /** Id of the return order the book was collected on. */
  orderId: string;
}

/** A book the customer still has out after this collection. */
export interface RemainingBook {
  title: string;
  /** ISO date string. */
  deadline: string;
}

/** Per-customer receipt entry shown after a collection. */
export interface CustomerCollectionReceipt {
  customerId: string;
  customerName: string;
  /** Number of books delivered now (X in "X/Y bøker levert"). */
  deliveredCount: number;
  /** Total active books the customer had (Y) = remaining after this collection + delivered now. */
  totalActiveCount: number;
  collectedBooks: CollectedBook[];
  remainingBooks: RemainingBook[];
}

export type BulkCollectionLookupResponse =
  | { success: true; book: ScannedBook }
  | { success: false; feedback: string };

export type BulkCollectionCollectResponse =
  | { success: true; receipt: CustomerCollectionReceipt[] }
  | { success: false; feedback: string };
