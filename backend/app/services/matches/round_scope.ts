import db from "@adonisjs/lucid/services/db";
import type { DateTime } from "luxon";

import CustomerItem from "#models/customer_item";
import { LOAN_ORDER_ITEM_TYPES } from "#shared/order/open-order-item";

/** Active customer items due on `deadline`, as a query on `customer_items`. */
function activeBooksAtDeadline(deadline: DateTime) {
  return CustomerItem.whereActive(
    db
      .from("customer_items")
      .whereNotNull("customer_items.customer_id")
      .where("customer_items.deadline", deadline.toISODate() ?? ""),
  );
}

function groupByCustomer(rows: { customerId: string; itemId: string }[]) {
  const held = new Map<string, Set<string>>();
  for (const { customerId, itemId } of rows) {
    held.set(customerId, (held.get(customerId) ?? new Set()).add(itemId));
  }
  return held;
}

export async function getHeldItems(
  branchIds: string[],
  deadline: DateTime,
  includeItemsFromOtherBranches: boolean,
): Promise<Map<string, Set<string>>> {
  const holders = activeBooksAtDeadline(deadline)
    .whereIn("customer_items.handout_branch_id", branchIds)
    .select("customer_items.customer_id");
  const rows: { customerId: string; itemId: string }[] = await (
    includeItemsFromOtherBranches
      ? activeBooksAtDeadline(deadline).whereIn("customer_items.customer_id", holders)
      : activeBooksAtDeadline(deadline).whereIn("customer_items.handout_branch_id", branchIds)
  ).distinct("customer_items.customer_id as customerId", "customer_items.item_id as itemId");
  return groupByCustomer(rows);
}

/**
 * The books each customer ordered themselves at the branches and still waits for: open rent and
 * partly-payment lines of placed orders, by customer id.
 */
export async function getWantedItems(branchIds: string[]): Promise<Map<string, Set<string>>> {
  const rows: { customerId: string; itemId: string }[] = await db
    .from("orders")
    .join("order_items", "order_items.order_id", "orders.id")
    .where("orders.placed", true)
    .where("orders.by_customer", true)
    .whereIn("orders.branch_id", branchIds)
    .whereNotNull("orders.customer_id")
    .where("order_items.handout", false)
    .whereNull("order_items.moved_to_order_id")
    .whereIn("order_items.type", [...LOAN_ORDER_ITEM_TYPES])
    .distinct("orders.customer_id as customerId", "order_items.item_id as itemId");

  return groupByCustomer(rows);
}
