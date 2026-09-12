import { ObjectId } from "mongodb";

import { BranchRelationshipService } from "#services/branch_relationship_service";
import { StorageService } from "#services/storage_service";
import type { BranchBookMovements, BranchBookMovementsYear } from "#shared/branch_insights";

const OSLO = "Europe/Oslo";

/**
 * One physical student-to-student transfer leaves two order items made within moments of each
 * other: the sender's match-deliver and the receiver's match-receive. Same window as the book
 * history uses to pair them.
 */
export const TRANSFER_PAIRING_WINDOW_MS = 120_000;

/** One aggregation row: order items of one kind in one year. */
export interface MovementRow {
  year: number;
  type: "rent" | "partly-payment" | "buy" | "return" | "buyback" | "cancel" | "buyout";
  handout: boolean;
  /** Whether the order item points at a customer item, i.e. concerns a book already handed out. */
  linked: boolean;
  count: number;
}

/** Books put on invoices made at the branch in one year, credited or not. */
export interface InvoiceRow {
  year: number;
  count: number;
}

/** One match-receive or match-deliver order item, from any branch. */
export interface MatchItemRow {
  type: "match-receive" | "match-deliver";
  blid: string | null;
  time: Date;
  year: number;
}

function emptyYear(year: number): BranchBookMovementsYear {
  return { year, handedOut: 0, collected: 0, transferred: 0, boughtOut: 0 };
}

/**
 * Transfers are attributed to the receiver's branch: every match-receive in scope counts, and a
 * match-deliver in scope counts only when no receive anywhere tells the same story. That keeps
 * legacy one-sided pairs to one movement while still counting a lone deliver once.
 */
export function countTransfersPerYear(
  scoped: MatchItemRow[],
  externalReceives: MatchItemRow[],
): Map<number, number> {
  const receivesByBlid = new Map<string, MatchItemRow[]>();
  for (const receive of [...scoped, ...externalReceives]) {
    if (receive.type !== "match-receive" || receive.blid === null) {
      continue;
    }
    const list = receivesByBlid.get(receive.blid) ?? [];
    list.push(receive);
    receivesByBlid.set(receive.blid, list);
  }
  const hasReceive = (deliver: MatchItemRow) =>
    deliver.blid !== null &&
    (receivesByBlid.get(deliver.blid) ?? []).some(
      (receive) =>
        Math.abs(receive.time.getTime() - deliver.time.getTime()) <= TRANSFER_PAIRING_WINDOW_MS,
    );

  const perYear = new Map<number, number>();
  for (const row of scoped) {
    if (row.type === "match-deliver" && hasReceive(row)) {
      continue;
    }
    perYear.set(row.year, (perYear.get(row.year) ?? 0) + 1);
  }
  return perYear;
}

/** Folds the aggregation rows into one consecutive row per year. */
export function buildBookMovements(
  rows: MovementRow[],
  invoiceRows: InvoiceRow[],
  transfersPerYear: Map<number, number>,
): BranchBookMovements {
  const byYear = new Map<number, BranchBookMovementsYear>();
  const yearOf = (year: number) => {
    const existing = byYear.get(year);
    if (existing) {
      return existing;
    }
    const created = emptyYear(year);
    byYear.set(year, created);
    return created;
  };

  for (const row of rows) {
    const year = yearOf(row.year);
    switch (row.type) {
      case "rent":
      case "partly-payment":
      case "buy": {
        if (row.handout) {
          year.handedOut += row.count;
        }
        break;
      }
      case "return":
      case "buyback": {
        year.collected += row.count;
        break;
      }
      case "cancel": {
        // A cancel of an order that was never handed out undoes nothing physical; only a cancel
        // of a handed-out book (one pointing at its customer item) brings a book back.
        if (row.linked) {
          year.collected += row.count;
        }
        break;
      }
      case "buyout": {
        year.boughtOut += row.count;
        break;
      }
    }
  }
  // A book on an invoice was never returned; the customer keeps it. Whether the invoice was
  // paid, sent to debt collection, written off or credited, the book left the lending pool
  // when the invoice was made. Paid invoices also leave an "invoice-paid" order item, which is
  // deliberately not counted so the book is not counted twice.
  for (const row of invoiceRows) {
    yearOf(row.year).boughtOut += row.count;
  }
  for (const [year, count] of transfersPerYear) {
    yearOf(year).transferred += count;
  }

  const years = [...byYear.keys()];
  if (years.length === 0) {
    return { years: [] };
  }
  const first = Math.min(...years);
  const last = Math.max(...years);
  return {
    years: Array.from({ length: last - first + 1 }, (_, index) => yearOf(first + index)).toSorted(
      (a, b) => a.year - b.year,
    ),
  };
}

const MOVEMENT_ITEM_TYPES = [
  "rent",
  "partly-payment",
  "buy",
  "return",
  "buyback",
  "cancel",
  "buyout",
];

const MATCH_ITEM_PROJECTION = {
  _id: 0,
  type: "$orderItems.type",
  blid: { $ifNull: ["$orderItems.blid", null] },
  time: "$creationTime",
  year: { $year: { date: "$creationTime", timezone: OSLO } },
};

export const BranchInsightsService = {
  async getBookMovements(branchId: string): Promise<BranchBookMovements> {
    const descendantIds = await BranchRelationshipService.getNestedChildBranchIds(branchId);
    const scope = [branchId, ...descendantIds].map((id) => new ObjectId(id));

    const [rows, invoiceRows, scopedMatchItems] = await Promise.all([
      StorageService.Orders.aggregate<MovementRow>([
        { $match: { placed: true, branch: { $in: scope } } },
        { $unwind: "$orderItems" },
        { $match: { "orderItems.type": { $in: MOVEMENT_ITEM_TYPES } } },
        {
          $group: {
            _id: {
              year: { $year: { date: "$creationTime", timezone: OSLO } },
              type: "$orderItems.type",
              handout: { $eq: ["$orderItems.handout", true] },
              linked: { $gt: ["$orderItems.customerItem", null] },
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            year: "$_id.year",
            type: "$_id.type",
            handout: "$_id.handout",
            linked: "$_id.linked",
            count: 1,
          },
        },
      ]),
      // One line per book; company invoice lines carry no customer item and are not books we lent.
      StorageService.Invoices.aggregate<InvoiceRow>([
        { $match: { branch: { $in: scope } } },
        { $unwind: "$customerItemPayments" },
        { $match: { "customerItemPayments.customerItem": { $ne: null } } },
        {
          $group: {
            _id: { $year: { date: "$creationTime", timezone: OSLO } },
            count: { $sum: 1 },
          },
        },
        { $project: { _id: 0, year: "$_id", count: 1 } },
      ]),
      StorageService.Orders.aggregate<MatchItemRow>([
        {
          $match: {
            placed: true,
            branch: { $in: scope },
            "orderItems.type": { $in: ["match-receive", "match-deliver"] },
          },
        },
        { $unwind: "$orderItems" },
        { $match: { "orderItems.type": { $in: ["match-receive", "match-deliver"] } } },
        { $project: MATCH_ITEM_PROJECTION },
      ]),
    ]);

    // A sender in scope may have handed the book to a student at another branch; that receive
    // is what turns the deliver into an already-counted transfer.
    const deliverBlids = [
      ...new Set(
        scopedMatchItems.flatMap((item) =>
          item.type === "match-deliver" && item.blid !== null ? [item.blid] : [],
        ),
      ),
    ];
    const externalReceives =
      deliverBlids.length === 0
        ? []
        : await StorageService.Orders.aggregate<MatchItemRow>([
            {
              $match: {
                placed: true,
                branch: { $nin: scope },
                "orderItems.type": "match-receive",
                "orderItems.blid": { $in: deliverBlids },
              },
            },
            { $unwind: "$orderItems" },
            {
              $match: {
                "orderItems.type": "match-receive",
                "orderItems.blid": { $in: deliverBlids },
              },
            },
            { $project: MATCH_ITEM_PROJECTION },
          ]);

    return buildBookMovements(
      rows,
      invoiceRows,
      countTransfersPerYear(scopedMatchItems, externalReceives),
    );
  },
};
