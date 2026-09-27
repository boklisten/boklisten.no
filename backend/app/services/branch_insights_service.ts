import db from "@adonisjs/lucid/services/db";
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
const TRANSFER_PAIRING_WINDOW_MS = 120_000;

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
interface InvoiceRow {
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

const MOVEMENT_ITEM_TYPES: MovementRow["type"][] = [
  "rent",
  "partly-payment",
  "buy",
  "return",
  "buyback",
  "cancel",
  "buyout",
];

const MATCH_ITEM_TYPES: MatchItemRow["type"][] = ["match-receive", "match-deliver"];

/** The calendar year in Oslo of the order a line belongs to. */
function orderYear() {
  return db.raw("extract(year from orders.created_at at time zone ?)::int as year", [OSLO]);
}

function placedOrderLines() {
  return db
    .from("order_items")
    .join("orders", "orders.id", "order_items.order_id")
    .where("orders.placed", true);
}

/** Lines of the movement kinds on placed orders of the branches, counted per year and kind. */
export async function countMovementRows(branchIds: string[]): Promise<MovementRow[]> {
  const rows: (Omit<MovementRow, "count"> & { count: string })[] = await placedOrderLines()
    .whereIn("orders.branch_id", branchIds)
    .whereIn("order_items.type", MOVEMENT_ITEM_TYPES)
    .select(
      orderYear(),
      "order_items.type",
      "order_items.handout",
      db.raw("order_items.customer_item_id is not null as linked"),
    )
    .count("* as count")
    .groupByRaw("1, 2, 3, 4");
  return rows.map((row) => ({
    year: row.year,
    type: row.type,
    handout: row.handout,
    linked: row.linked,
    count: Number(row.count),
  }));
}

/**
 * Match lines on placed orders: of the given branches, or (with `outside`) of every other branch,
 * narrowed to the given types and blids.
 */
export async function findMatchItemRows({
  branchIds,
  outside = false,
  types = MATCH_ITEM_TYPES,
  blids,
}: {
  branchIds: string[];
  outside?: boolean;
  types?: MatchItemRow["type"][];
  blids?: string[];
}): Promise<MatchItemRow[]> {
  const query = placedOrderLines()
    .whereIn("order_items.type", types)
    .select("order_items.type", "order_items.blid", "orders.created_at as time", orderYear());
  void (outside
    ? query.whereNotIn("orders.branch_id", branchIds)
    : query.whereIn("orders.branch_id", branchIds));
  if (blids) {
    void query.whereIn("order_items.blid", blids);
  }
  return query;
}

export const BranchInsightsService = {
  async getBookMovements(branchId: string): Promise<BranchBookMovements> {
    const descendantIds = await BranchRelationshipService.getNestedChildBranchIds(branchId);
    const scopeIds = [branchId, ...descendantIds];
    const scope = scopeIds.map((id) => new ObjectId(id));

    const [rows, invoiceRows, scopedMatchItems] = await Promise.all([
      countMovementRows(scopeIds),
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
      findMatchItemRows({ branchIds: scopeIds }),
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
        : await findMatchItemRows({
            branchIds: scopeIds,
            outside: true,
            types: ["match-receive"],
            blids: deliverBlids,
          });

    return buildBookMovements(
      rows,
      invoiceRows,
      countTransfersPerYear(scopedMatchItems, externalReceives),
    );
  },
};
