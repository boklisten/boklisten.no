import type { CustomerItemType } from "#shared/customer-item/customer-item-type";

/** A party that can hold or hand over a book: a customer, or the stand itself. */
export type BlidParty = { type: "customer"; detailsId: string; name: string } | { type: "stand" };

export type BlidHistoryAction =
  | "handout"
  | "return"
  | "match-transfer"
  | "extend"
  | "buyout"
  /** The customer kept the book and paid the invoice sent for it. */
  | "invoice-paid"
  | "buyback"
  | "cancel"
  /** Synthetic: the book is still held and its deadline has passed. */
  | "deadline-expired";

/** One event in a book's life, assembled from orders, customer items and book handovers. */
export interface BlidHistoryEvent {
  /** ISO timestamp with second precision. */
  time: string;
  action: BlidHistoryAction;
  /** Who gave the book away — or, for buyback/cancel, the customer who gave it up. Missing on legacy match orders where the counterparty is unknown. */
  from?: BlidParty;
  /** Who got the book — or, for buyout/extend, the customer holding it. */
  to?: BlidParty;
  /** The employee on the order, when one was involved and still resolvable. */
  employee?: { detailsId: string; name: string };
  /** True when the customer performed the action themselves (e.g. scanned a match transfer). */
  byCustomer: boolean;
  /** The branch the order/handout belongs to. */
  branchName?: string;
  /** The deadline in effect after this event. */
  deadline?: string;
  /** The deadline that was replaced, for extends. */
  previousDeadline?: string;
  /** For handouts: whether the book was rented/loaned out or partly paid. Missing when unknown. */
  handoutType?: CustomerItemType;
  orderId?: string;
}

/**
 * Where the book stands now. "bought-out" means a customer bought the book and keeps it;
 * a buyback (Boklisten bought it back) leaves the book at the stand, i.e. "not-handed-out".
 */
export type BlidStatus = "handed-out" | "bought-out" | "not-handed-out";

/** The actively held customer item, present when status is "handed-out" — what admin corrections operate on. */
export interface BlidActiveItem {
  customerItemId: string;
  /** ISO timestamp. */
  deadline: string;
  /** null on legacy items handed out by a customer, where no branch is recorded. */
  handoutBranchId: string | null;
}

export interface BlidSearchResult {
  blid: string;
  /** null when the blid has never been connected to an item. */
  book: { title: string; isbn: string } | null;
  status: BlidStatus;
  activeItem?: BlidActiveItem;
  /** Sorted newest first. */
  history: BlidHistoryEvent[];
}
