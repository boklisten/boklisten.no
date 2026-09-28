import db from "@adonisjs/lucid/services/db";
import type { DateTime } from "luxon";

import Branch from "#models/branch";
import CustomerItem from "#models/customer_item";
import type MatchRound from "#models/match_round";
import User from "#models/user";
import { BlError } from "#shared/bl-error";
import { canonicalItemId } from "#shared/item-equivalence";
import { LOAN_ORDER_ITEM_TYPES } from "#shared/order/open-order-item";

/** One book a customer holds or waits for, and the branch it was handed out or ordered at. */
interface ScopedBook {
  customerId: string;
  itemId: string;
  branchId: string;
}

export type BooksByCustomer = Map<string, Set<string>>;

export interface StandRuleIds {
  standBranchIds?: string[];
  standCustomerIds?: string[];
}

/**
 * Where a round draws its books from, with its stand rules expanded: the round's branch and every
 * descendant, the subtrees whose books all go via the stand, and the students who get no student
 * matches.
 */
export interface RoundScope {
  branchIds: string[];
  standBranchIds: Set<string>;
  standCustomerIds: Set<string>;
}

async function subtreeIds(branchId: string): Promise<string[]> {
  return [branchId, ...(await Branch.descendantIds(branchId))];
}

/**
 * Refuses stand rules that point outside the round: a stand branch must be a descendant of the
 * round's branch (the branch itself would send every book to the stand), and a stand student
 * must exist.
 */
export async function assertStandRules(
  branchId: string,
  { standBranchIds = [], standCustomerIds = [] }: StandRuleIds,
) {
  if (standBranchIds.length > 0) {
    const descendants = new Set(await Branch.descendantIds(branchId));
    if (standBranchIds.some((id) => !descendants.has(id))) {
      throw new BlError("Stand-filialene må ligge under rundens filial").code(701);
    }
  }
  if (standCustomerIds.length > 0) {
    const customers = await User.byIds(standCustomerIds);
    if (customers.size !== standCustomerIds.length) {
      throw new BlError("Fant ikke alle elevene som skal via stand").code(701);
    }
  }
}

export async function resolveRoundScope(round: MatchRound): Promise<RoundScope> {
  await round.load((loader) => {
    loader.load("standBranches").load("standCustomers");
  });
  const [branchIds, standSubtrees] = await Promise.all([
    subtreeIds(round.branchId),
    Promise.all(round.standBranches.map((branch) => subtreeIds(branch.id))),
  ]);
  return {
    branchIds,
    standBranchIds: new Set(standSubtrees.flat()),
    standCustomerIds: new Set(round.standCustomers.map((customer) => customer.id)),
  };
}

/** Active customer items due on `deadline`, as a query on `customer_items`. */
function activeBooksAtDeadline(deadline: DateTime) {
  return CustomerItem.whereActive(
    db
      .from("customer_items")
      .whereNotNull("customer_items.customer_id")
      .where("customer_items.deadline", deadline.toISODate() ?? ""),
  );
}

/** The active books due on the deadline that were handed out at the branches. */
async function getHeldBooks(branchIds: string[], deadline: DateTime): Promise<ScopedBook[]> {
  return activeBooksAtDeadline(deadline)
    .whereIn("customer_items.handout_branch_id", branchIds)
    .distinct(
      "customer_items.customer_id as customerId",
      "customer_items.item_id as itemId",
      "customer_items.handout_branch_id as branchId",
    );
}

/**
 * The books each customer ordered themselves at the branches and still waits for: open rent and
 * partly-payment lines of placed orders.
 */
async function getWantedBooks(branchIds: string[]): Promise<ScopedBook[]> {
  return db
    .from("orders")
    .join("order_items", "order_items.order_id", "orders.id")
    .where("orders.placed", true)
    .where("orders.by_customer", true)
    .whereIn("orders.branch_id", branchIds)
    .whereNotNull("orders.customer_id")
    .where("order_items.handout", false)
    .whereNull("order_items.moved_to_order_id")
    .whereIn("order_items.type", [...LOAN_ORDER_ITEM_TYPES])
    .distinct(
      "orders.customer_id as customerId",
      "order_items.item_id as itemId",
      "orders.branch_id as branchId",
    );
}

function add(byCustomer: BooksByCustomer, customerId: string, itemId: string) {
  byCustomer.set(customerId, (byCustomer.get(customerId) ?? new Set()).add(itemId));
}

/**
 * Splits the books into those the match finder may pair between students and those that go
 * straight to the stand: every book of a stand student, and every book handed out or ordered in a
 * stand subtree.
 *
 * A title a customer must take via the stand is never also offered to the finder, not even as an
 * equivalent edition, so no student is matched for a book that is already on its way to the stand.
 */
function splitByRoute(books: ScopedBook[], scope: RoundScope) {
  const matchable: BooksByCustomer = new Map();
  const standOnly: BooksByCustomer = new Map();
  for (const { customerId, itemId, branchId } of books) {
    const toStand = scope.standCustomerIds.has(customerId) || scope.standBranchIds.has(branchId);
    add(toStand ? standOnly : matchable, customerId, itemId);
  }

  for (const [customerId, standItems] of standOnly) {
    const items = matchable.get(customerId);
    if (!items) {
      continue;
    }
    const standTitles = new Set([...standItems].map(canonicalItemId));
    for (const itemId of items) {
      if (standTitles.has(canonicalItemId(itemId))) {
        items.delete(itemId);
      }
    }
    if (items.size === 0) {
      matchable.delete(customerId);
    }
  }
  return { matchable, standOnly };
}

export interface RoundBooks {
  held: { matchable: BooksByCustomer; standOnly: BooksByCustomer };
  wanted: { matchable: BooksByCustomer; standOnly: BooksByCustomer };
}

/** Every book the round moves, by customer, split into matchable and stand-only. */
export async function getRoundBooks(round: MatchRound, scope: RoundScope): Promise<RoundBooks> {
  const [held, wanted] = await Promise.all([
    getHeldBooks(scope.branchIds, round.deadline),
    getWantedBooks(scope.branchIds),
  ]);
  return { held: splitByRoute(held, scope), wanted: splitByRoute(wanted, scope) };
}
