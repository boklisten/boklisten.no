import type { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import type { PipelineStage } from "mongoose";

import { deadlineWindow } from "#services/deadline_window";
import { StorageService } from "#services/storage_service";

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
    "handoutInfo.handoutBy": "branch",
    "handoutInfo.handoutById": { $in: toObjectIds(branchIds) },
  };
}

function orderedBooksAt(branchIds: string[]): PipelineStage[] {
  return [
    {
      $match: {
        placed: true,
        byCustomer: true,
        handoutByDelivery: { $ne: true },
        branch: { $in: toObjectIds(branchIds) },
      },
    },
    {
      $addFields: {
        orderItems: {
          $filter: {
            input: "$orderItems",
            as: "orderItem",
            cond: {
              $and: [
                { $not: "$$orderItem.handout" },
                { $not: "$$orderItem.movedToOrder" },
                { $in: ["$$orderItem.type", ["rent", "partly-payment"]] },
              ],
            },
          },
        },
      },
    },
    { $match: { $expr: { $gt: [{ $size: "$orderItems" }, 0] } } },
    { $unwind: "$orderItems" },
  ];
}

export function membersOfBranches(branchIds: string[]) {
  return { branchMembership: { $in: toObjectIds(branchIds) } };
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

export async function getWantedItems(branchIds: string[]): Promise<Map<string, Set<string>>> {
  const aggregated = await StorageService.Orders.aggregate<{ id: string; wantedItems: string[] }>([
    ...orderedBooksAt(branchIds),
    {
      $group: {
        _id: "$customer",
        id: { $first: "$customer" },
        wantedItems: { $addToSet: "$orderItems.item" },
      },
    },
  ]);

  return new Map(
    aggregated.map((receiver) => [String(receiver.id), new Set(receiver.wantedItems.map(String))]),
  );
}
