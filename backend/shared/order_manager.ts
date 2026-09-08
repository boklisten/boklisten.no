import type { OrderHistoryEntry } from "#shared/order/order-history";
import type { OrderItemType } from "#shared/order/order-item/order-item-type";

/** The two Bring products the stand ships with; Mybring's bulk import wants one file per product. */
export const BRING_PARCEL_TYPES = ["postkasse", "hentested"] as const;
export type BringParcelType = (typeof BRING_PARCEL_TYPES)[number];

export const BRING_PARCEL_LABELS: Record<BringParcelType, string> = {
  postkasse: "Pakke i postkassen",
  hentested: "Pakke til hentested",
};

export const ORDER_MANAGER_PAGE_SIZE = 50;

/** What narrows the list; the exports take the same filter so a download is the list in full. */
export interface OrderManagerFilter {
  /** Order branches to include, descendants already expanded by the picker. Empty means all. */
  branchIds?: string[];
  /** Only orders that are to be sent by mail. */
  bringOnly?: boolean;
}

export interface OrderManagerOpenItem {
  itemId: string;
  title: string;
  type: OrderItemType;
}

/** One open order in the list: enough to recognise it and to know what is still owed. */
export interface OrderManagerRow {
  id: string;
  /** ISO timestamp. */
  creationTime: string;
  customer: { id: string; name: string };
  branch: { id: string; name: string | null };
  openItems: OrderManagerOpenItem[];
  /** To be sent by mail. */
  bring: boolean;
  /** Costs something and no payment is recorded. */
  unpaid: boolean;
}

export interface OrderManagerPage {
  rows: OrderManagerRow[];
  /** Pass back to get the orders older than the last row; null when this was the last page. */
  nextCursor: string | null;
}

/** The selected order as the order history presents it, plus whose it is. */
export interface OrderManagerDetail {
  customerId: string;
  order: OrderHistoryEntry;
}

/** One row per open book, with the columns the legacy overview had plus birth date and membership. */
export interface OrderManagerReportRow {
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  /** DD.MM.YYYY. */
  dob: string | null;
  branchMembership: string | null;
  /** The order's branch. */
  school: string | null;
  title: string;
  isbn: string | null;
  /** ISO timestamp. */
  orderTime: string;
  paid: boolean;
  /** Constant 1, so a spreadsheet pivot can count rows. */
  pivot: number;
}

/** One row per Bring order, keyed by Mybring's bulk-import headers for the parcel type. */
export type BringReportRow = Record<string, string | number>;
