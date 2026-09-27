import db from "@adonisjs/lucid/services/db";
import type { DateTime } from "luxon";
import { ObjectId } from "mongodb";

import { deadlineWindow } from "#services/deadline_window";
import { StorageService } from "#services/storage_service";
import { LOAN_ORDER_ITEM_TYPES } from "#shared/order/open-order-item";

function toObjectIds(ids: string[]): ObjectId[] {
  return ids.map((id) => new ObjectId(id));
}

function activeBooksAtDeadline(deadline: DateTime) {
  const { after, before } = deadlineWindow(deadline);
  return {
    returned: false,
    buyout: false,
    cancel: false,
    buyback: false,
    deadline: { $gt: after, $lt: before },
  };
}

function activeBooksHandedOutAt(branchIds: string[], deadline: DateTime) {
  return {
    ...activeBooksAtDeadline(deadline),
    "handoutInfo.handoutById": { $in: toObjectIds(branchIds) },
  };
}

const groupByCustomer = {
  $group: {
    _id: "$customer",
    id: { $first: "$customer" },
    items: { $addToSet: "$item" },
  },
};

export async function getHeldItems(
  branchIds: string[],
  deadline: DateTime,
  includeItemsFromOtherBranches: boolean,
): Promise<Map<string, Set<string>>> {
  let aggregated = await StorageService.CustomerItems.aggregate<{ id: string; items: string[] }>([
    { $match: activeBooksHandedOutAt(branchIds, deadline) },
    groupByCustomer,
  ]);

  if (includeItemsFromOtherBranches) {
    aggregated = await StorageService.CustomerItems.aggregate<{ id: string; items: string[] }>([
      {
        $match: {
          ...activeBooksAtDeadline(deadline),
          customer: { $in: aggregated.map((sender) => new ObjectId(sender.id)) },
        },
      },
      groupByCustomer,
    ]);
  }

  return new Map(
    aggregated.map((sender) => [String(sender.id), new Set(sender.items.map(String))]),
  );
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

  const wanted = new Map<string, Set<string>>();
  for (const { customerId, itemId } of rows) {
    wanted.set(customerId, (wanted.get(customerId) ?? new Set()).add(itemId));
  }
  return wanted;
}
