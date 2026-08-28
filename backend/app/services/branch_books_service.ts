import { DateTime } from "luxon";
import { ObjectId } from "mongodb";

import { BlSchemaName } from "#models/mongoose/storage/bl-schema-names";
import { BranchRelationshipService } from "#services/branch_relationship_service";
import { DEADLINE_PADDING_DAYS } from "#services/deadline_window";
import { OrderCancellationService } from "#services/order_cancellation_service";
import { StorageService } from "#services/storage_service";

export interface BranchBooksTitle {
  itemId: string;
  title: string;
  direct: number;
  indirect: number;
  total: number;
}

export interface BranchBooksGroup {
  /** Canonical deadline for display, ISO string */
  deadline: string;
  /** Exact deadline values covered by this group, used to address it in details/updates */
  deadlines: string[];
  direct: number;
  indirect: number;
  total: number;
  titles: BranchBooksTitle[];
}

export interface BranchBooksSummary {
  direct: number;
  indirect: number;
  total: number;
  groups: BranchBooksGroup[];
}

export interface BranchBooksFilter {
  deadlines?: string[];
  itemId?: string;
  includeDescendants: boolean;
}

export interface BranchBooksUpdate {
  deadline?: string;
  branchId?: string;
}

export interface SummaryRow {
  deadline: Date;
  itemId: string;
  title: string;
  direct: number;
  total: number;
}

const DEADLINE_PADDING_MS = DEADLINE_PADDING_DAYS * 24 * 60 * 60 * 1000;

export const ACTIVE_CUSTOMER_ITEM_MATCH = {
  returned: false,
  buyout: false,
  cancel: false,
  handout: true,
};

export const OPEN_ORDER_ITEM_MATCH = {
  "orderItems.type": { $in: ["rent", "partly-payment"] },
  "orderItems.handout": { $ne: true },
  "orderItems.delivered": { $ne: true },
  "orderItems.movedToOrder": null,
};

async function resolveScope(branchId: string) {
  const descendantIds = await BranchRelationshipService.getNestedChildBranchIds(branchId);
  return {
    branchObjectId: new ObjectId(branchId),
    scopeObjectIds: [branchId, ...descendantIds].map((id) => new ObjectId(id)),
  };
}

/**
 * Group deadlines that fall within DEADLINE_PADDING_DAYS of each other, so deadlines that are
 * off by a day or two (the same drift deadlineWindow pads around) are treated as one deadline.
 * The most common deadline in a cluster becomes its anchor.
 */
export function clusterDeadlines(
  deadlineCounts: { deadline: Date; count: number }[],
): { anchor: Date; members: Date[] }[] {
  const countByTime = new Map<number, number>();
  for (const { deadline, count } of deadlineCounts) {
    const time = deadline.getTime();
    countByTime.set(time, (countByTime.get(time) ?? 0) + count);
  }
  const sorted = [...countByTime.entries()].toSorted(
    ([timeA, countA], [timeB, countB]) => countB - countA || timeA - timeB,
  );
  const claimed = new Set<number>();
  const clusters: { anchor: Date; members: Date[] }[] = [];
  for (const [anchorTime] of sorted) {
    if (claimed.has(anchorTime)) continue;
    const members = sorted
      .map(([time]) => time)
      .filter((time) => !claimed.has(time) && Math.abs(time - anchorTime) < DEADLINE_PADDING_MS);
    for (const memberTime of members) claimed.add(memberTime);
    clusters.push({
      anchor: new Date(anchorTime),
      members: members.toSorted((a, b) => a - b).map((time) => new Date(time)),
    });
  }
  return clusters.toSorted((a, b) => a.anchor.getTime() - b.anchor.getTime());
}

export function buildSummary(rows: SummaryRow[]): BranchBooksSummary {
  const clusters = clusterDeadlines(
    rows.map((row) => ({ deadline: row.deadline, count: row.total })),
  );
  const groups = clusters.map(({ anchor, members }) => {
    const memberTimes = new Set(members.map((member) => member.getTime()));
    const titleById = new Map<string, BranchBooksTitle>();
    for (const row of rows) {
      if (!memberTimes.has(row.deadline.getTime())) continue;
      const entry = titleById.get(row.itemId) ?? {
        itemId: row.itemId,
        title: row.title,
        direct: 0,
        indirect: 0,
        total: 0,
      };
      entry.direct += row.direct;
      entry.indirect += row.total - row.direct;
      entry.total += row.total;
      titleById.set(row.itemId, entry);
    }
    const titles = [...titleById.values()].toSorted((a, b) => a.title.localeCompare(b.title));
    return {
      deadline: anchor.toISOString(),
      deadlines: members.map((member) => member.toISOString()),
      direct: titles.reduce((sum, title) => sum + title.direct, 0),
      indirect: titles.reduce((sum, title) => sum + title.indirect, 0),
      total: titles.reduce((sum, title) => sum + title.total, 0),
      titles,
    };
  });
  return {
    direct: groups.reduce((sum, group) => sum + group.direct, 0),
    indirect: groups.reduce((sum, group) => sum + group.indirect, 0),
    total: groups.reduce((sum, group) => sum + group.total, 0),
    groups,
  };
}

function toBirthYear(dob: Date | null | undefined): string | null {
  return dob ? DateTime.fromJSDate(dob).toFormat("yyyy") : null;
}

// preserveNullAndEmptyArrays so books whose customer has been deleted still show up in the
// details list — the counts and bulk updates include them either way
const CUSTOMER_LOOKUP_STAGES = [
  {
    $lookup: {
      from: BlSchemaName.UserDetails,
      localField: "customer",
      foreignField: "_id",
      as: "customer",
    },
  },
  { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
  {
    $lookup: {
      from: BlSchemaName.Branches,
      localField: "customer.branchMembership",
      foreignField: "_id",
      as: "membershipBranch",
    },
  },
  { $unwind: { path: "$membershipBranch", preserveNullAndEmptyArrays: true } },
];

// preserveNullAndEmptyArrays so books referencing a deleted item keep counting in the summary —
// bulk updates addressed by deadline include them either way
const ITEM_TITLE_STAGES = [
  {
    $lookup: {
      from: BlSchemaName.Items,
      localField: "_id.item",
      foreignField: "_id",
      as: "item",
    },
  },
  { $unwind: { path: "$item", preserveNullAndEmptyArrays: true } },
  {
    $project: {
      _id: 0,
      deadline: "$_id.deadline",
      itemId: { $toString: "$_id.item" },
      title: { $ifNull: ["$item.title", "Ukjent bok"] },
      direct: 1,
      total: 1,
    },
  },
];

/**
 * Aggregation expression matching an open (ordered, not yet handed out) order item, usable both
 * in $filter/$map conditions and update pipelines. orderItems.info is a Mixed field where `to`
 * is stored as either a Date or a "yyyy-MM-dd" string, hence the $convert.
 */
function openOrderItemCondition(options: {
  deadlines?: Date[];
  itemObjectId?: ObjectId;
  orderItemObjectIds?: ObjectId[];
}) {
  const conditions: unknown[] = [
    { $in: ["$$orderItem.type", ["rent", "partly-payment"]] },
    { $ne: ["$$orderItem.handout", true] },
    { $ne: ["$$orderItem.delivered", true] },
    { $eq: [{ $ifNull: ["$$orderItem.movedToOrder", null] }, null] },
  ];
  if (options.deadlines) {
    conditions.push({
      $in: [
        { $convert: { input: "$$orderItem.info.to", to: "date", onError: null, onNull: null } },
        options.deadlines,
      ],
    });
  }
  if (options.itemObjectId) {
    conditions.push({ $eq: ["$$orderItem.item", options.itemObjectId] });
  }
  if (options.orderItemObjectIds) {
    conditions.push({ $in: ["$$orderItem._id", options.orderItemObjectIds] });
  }
  return { $and: conditions };
}

export const BranchBooksService = {
  clusterDeadlines,

  async getActiveBooksSummary(branchId: string): Promise<BranchBooksSummary> {
    const { branchObjectId, scopeObjectIds } = await resolveScope(branchId);
    const rows = await StorageService.CustomerItems.aggregate<SummaryRow>([
      {
        $match: {
          ...ACTIVE_CUSTOMER_ITEM_MATCH,
          "handoutInfo.handoutById": { $in: scopeObjectIds },
          deadline: { $ne: null },
        },
      },
      {
        $group: {
          _id: { deadline: "$deadline", item: "$item" },
          direct: {
            $sum: { $cond: [{ $eq: ["$handoutInfo.handoutById", branchObjectId] }, 1, 0] },
          },
          total: { $sum: 1 },
        },
      },
      ...ITEM_TITLE_STAGES,
    ]);
    return buildSummary(rows);
  },

  async getActiveBookDetails({
    branchId,
    deadlines,
    itemId,
  }: {
    branchId: string;
    deadlines: string[];
    itemId: string;
  }) {
    const rows = await StorageService.CustomerItems.aggregate<{
      customerItemId: string;
      customerName: string | null;
      dob: Date | null;
      membershipBranchName: string | null;
      blid: string | null;
      handoutTime: Date | null;
    }>([
      {
        $match: {
          ...ACTIVE_CUSTOMER_ITEM_MATCH,
          "handoutInfo.handoutById": new ObjectId(branchId),
          item: new ObjectId(itemId),
          deadline: { $in: deadlines.map((deadline) => new Date(deadline)) },
        },
      },
      { $sort: { "handoutInfo.time": 1 } },
      ...CUSTOMER_LOOKUP_STAGES,
      {
        $project: {
          _id: 0,
          customerItemId: { $toString: "$_id" },
          customerName: { $ifNull: ["$customer.name", null] },
          dob: { $ifNull: ["$customer.dob", null] },
          membershipBranchName: { $ifNull: ["$membershipBranch.name", null] },
          blid: { $ifNull: ["$blid", null] },
          handoutTime: { $ifNull: ["$handoutInfo.time", null] },
        },
      },
    ]);
    return rows.map(({ dob, ...row }) => ({
      ...row,
      birthYear: toBirthYear(dob),
      handoutTime: row.handoutTime ? row.handoutTime.toISOString() : null,
    }));
  },

  async bulkUpdateActiveBooks({
    branchId,
    filter,
    update,
  }: {
    branchId: string;
    filter: BranchBooksFilter & { customerItemIds?: string[] };
    update: BranchBooksUpdate;
  }) {
    const { branchObjectId, scopeObjectIds } = await resolveScope(branchId);
    const mongoFilter = {
      ...ACTIVE_CUSTOMER_ITEM_MATCH,
      "handoutInfo.handoutById": {
        $in: filter.includeDescendants ? scopeObjectIds : [branchObjectId],
      },
      ...(filter.deadlines && {
        deadline: { $in: filter.deadlines.map((deadline) => new Date(deadline)) },
      }),
      ...(filter.itemId && { item: new ObjectId(filter.itemId) }),
      ...(filter.customerItemIds && {
        _id: { $in: filter.customerItemIds.map((id) => new ObjectId(id)) },
      }),
    };
    const set: Record<string, unknown> = { lastUpdated: new Date() };
    if (update.deadline) set["deadline"] = new Date(update.deadline);
    if (update.branchId) set["handoutInfo.handoutById"] = new ObjectId(update.branchId);
    const result = await StorageService.CustomerItems.updateMany(mongoFilter, { $set: set });
    return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
  },

  async getOrderedBooksSummary(branchId: string): Promise<BranchBooksSummary> {
    const { branchObjectId, scopeObjectIds } = await resolveScope(branchId);
    const rows = await StorageService.Orders.aggregate<SummaryRow>([
      { $match: { placed: true, branch: { $in: scopeObjectIds } } },
      { $unwind: "$orderItems" },
      { $match: OPEN_ORDER_ITEM_MATCH },
      {
        $addFields: {
          deadlineDate: {
            $convert: { input: "$orderItems.info.to", to: "date", onError: null, onNull: null },
          },
        },
      },
      { $match: { deadlineDate: { $ne: null } } },
      {
        $group: {
          _id: { deadline: "$deadlineDate", item: "$orderItems.item" },
          direct: { $sum: { $cond: [{ $eq: ["$branch", branchObjectId] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
      ...ITEM_TITLE_STAGES,
    ]);
    return buildSummary(rows);
  },

  async getOrderedBookDetails({
    branchId,
    deadlines,
    itemId,
  }: {
    branchId: string;
    deadlines: string[];
    itemId: string;
  }) {
    const rows = await StorageService.Orders.aggregate<{
      orderId: string;
      orderItemId: string;
      customerName: string | null;
      dob: Date | null;
      membershipBranchName: string | null;
      orderTime: Date | null;
    }>([
      { $match: { placed: true, branch: new ObjectId(branchId) } },
      { $unwind: "$orderItems" },
      { $match: { ...OPEN_ORDER_ITEM_MATCH, "orderItems.item": new ObjectId(itemId) } },
      {
        $addFields: {
          deadlineDate: {
            $convert: { input: "$orderItems.info.to", to: "date", onError: null, onNull: null },
          },
        },
      },
      { $match: { deadlineDate: { $in: deadlines.map((deadline) => new Date(deadline)) } } },
      { $sort: { creationTime: 1 } },
      ...CUSTOMER_LOOKUP_STAGES,
      {
        $project: {
          _id: 0,
          orderId: { $toString: "$_id" },
          orderItemId: { $toString: "$orderItems._id" },
          customerName: { $ifNull: ["$customer.name", null] },
          dob: { $ifNull: ["$customer.dob", null] },
          membershipBranchName: { $ifNull: ["$membershipBranch.name", null] },
          orderTime: { $ifNull: ["$creationTime", null] },
        },
      },
    ]);
    return rows.map(({ dob, ...row }) => ({
      ...row,
      birthYear: toBirthYear(dob),
      orderTime: row.orderTime ? row.orderTime.toISOString() : null,
    }));
  },

  async bulkUpdateOrderedBooks({
    branchId,
    filter,
    update,
  }: {
    branchId: string;
    filter: BranchBooksFilter & { orderItemIds?: string[] };
    update: BranchBooksUpdate;
  }) {
    const { branchObjectId, scopeObjectIds } = await resolveScope(branchId);
    const condition = openOrderItemCondition({
      deadlines: filter.deadlines?.map((deadline) => new Date(deadline)),
      itemObjectId: filter.itemId ? new ObjectId(filter.itemId) : undefined,
      orderItemObjectIds: filter.orderItemIds?.map((id) => new ObjectId(id)),
    });
    const mongoFilter = {
      placed: true,
      branch: { $in: filter.includeDescendants ? scopeObjectIds : [branchObjectId] },
      $expr: {
        $gt: [
          { $size: { $filter: { input: "$orderItems", as: "orderItem", cond: condition } } },
          0,
        ],
      },
    };
    if (update.branchId) {
      const result = await StorageService.Orders.updateMany(mongoFilter, {
        $set: { branch: new ObjectId(update.branchId), lastUpdated: new Date() },
      });
      return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
    }
    const result = await StorageService.Orders.updateMany(
      mongoFilter,
      [
        {
          $set: {
            orderItems: {
              $map: {
                input: "$orderItems",
                as: "orderItem",
                in: {
                  $cond: [
                    condition,
                    {
                      $mergeObjects: [
                        "$$orderItem",
                        {
                          info: {
                            $mergeObjects: [
                              { $ifNull: ["$$orderItem.info", {}] },
                              { to: new Date(update.deadline ?? "") },
                            ],
                          },
                        },
                      ],
                    },
                    "$$orderItem",
                  ],
                },
              },
            },
            lastUpdated: new Date(),
          },
        },
      ],
      { updatePipeline: true },
    );
    return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
  },

  async bulkCancelOrderedBooks({
    branchId,
    filter,
    notifyCustomers,
    employeeDetailsId,
  }: {
    branchId: string;
    filter: BranchBooksFilter & { orderItemIds?: string[] };
    notifyCustomers: boolean;
    employeeDetailsId: string;
  }) {
    const { branchObjectId, scopeObjectIds } = await resolveScope(branchId);
    const condition = openOrderItemCondition({
      deadlines: filter.deadlines?.map((deadline) => new Date(deadline)),
      itemObjectId: filter.itemId ? new ObjectId(filter.itemId) : undefined,
      orderItemObjectIds: filter.orderItemIds?.map((id) => new ObjectId(id)),
    });
    const candidates = await StorageService.Orders.aggregate<{
      orderId: string;
      branch: string;
      customer: string;
      amount: number;
      cancelItems: { item: string; title: string }[];
    }>([
      {
        $match: {
          placed: true,
          branch: { $in: filter.includeDescendants ? scopeObjectIds : [branchObjectId] },
        },
      },
      {
        $addFields: {
          cancelItems: { $filter: { input: "$orderItems", as: "orderItem", cond: condition } },
        },
      },
      { $match: { $expr: { $gt: [{ $size: "$cancelItems" }, 0] } } },
      {
        $project: {
          _id: 0,
          orderId: { $toString: "$_id" },
          branch: { $toString: "$branch" },
          customer: { $toString: "$customer" },
          amount: 1,
          cancelItems: {
            $map: {
              input: "$cancelItems",
              as: "orderItem",
              in: { item: { $toString: "$$orderItem.item" }, title: "$$orderItem.title" },
            },
          },
        },
      },
    ]);

    // Orders with money on them are skipped: cancelling those means refunds, which are handled manually
    const cancellable = candidates.filter((order) => order.amount === 0);
    const skipped = candidates.filter((order) => order.amount !== 0);
    for (const order of cancellable) {
      await OrderCancellationService.cancelOrderItems({
        originalOrder: { id: order.orderId, branch: order.branch, customer: order.customer },
        orderItems: order.cancelItems,
        employeeDetailsId,
        notifyCustomer: notifyCustomers,
      });
    }
    return {
      cancelledOrders: cancellable.length,
      cancelledBooks: cancellable.reduce((sum, order) => sum + order.cancelItems.length, 0),
      skippedBooks: skipped.reduce((sum, order) => sum + order.cancelItems.length, 0),
    };
  },
};
