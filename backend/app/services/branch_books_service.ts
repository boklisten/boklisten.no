import db from "@adonisjs/lucid/services/db";
import { DateTime } from "luxon";

import Branch from "#models/branch";
import CustomerItem from "#models/customer_item";
import User from "#models/user";
import Item from "#models/item";
import Order from "#models/order";
import OrderItem from "#models/order_item";
import { BranchRelationshipService } from "#services/branch_relationship_service";
import { DEADLINE_PADDING_DAYS } from "#services/deadline_window";
import { OrderCancellationService } from "#services/order_cancellation_service";
import { LOAN_ORDER_ITEM_TYPES } from "#shared/order/open-order-item";

interface BranchBooksTitle {
  itemId: string;
  title: string;
  direct: number;
  indirect: number;
  total: number;
}

interface BranchBooksGroup {
  /** Canonical deadline for display, ISO string */
  deadline: string;
  /** Exact deadline values covered by this group, used to address it in details/updates */
  deadlines: string[];
  direct: number;
  indirect: number;
  total: number;
  titles: BranchBooksTitle[];
}

interface BranchBooksSummary {
  direct: number;
  indirect: number;
  total: number;
  groups: BranchBooksGroup[];
}

interface BranchBooksFilter {
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

async function resolveScope(branchId: string) {
  const descendantIds = await BranchRelationshipService.getNestedChildBranchIds(branchId);
  return { scopeIds: [branchId, ...descendantIds] };
}

/** Active customer items handed out from the given branches, as a query on `customer_items`. */
function activeBooksQuery(branchIds: string[]) {
  return CustomerItem.whereActive(
    db.from("customer_items").whereIn("customer_items.handout_branch_id", branchIds),
  );
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
    if (claimed.has(anchorTime)) {
      continue;
    }
    const members = sorted
      .map(([time]) => time)
      .filter((time) => !claimed.has(time) && Math.abs(time - anchorTime) < DEADLINE_PADDING_MS);
    for (const memberTime of members) {
      claimed.add(memberTime);
    }
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
      if (!memberTimes.has(row.deadline.getTime())) {
        continue;
      }
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

/**
 * The customer columns of a details row. Books whose customer has been deleted still show up in
 * the details list (the counts and bulk updates include them either way), without a name.
 */
async function withCustomerColumns<Row extends { customerId: string | null }>(
  rows: Row[],
): Promise<
  (Row & {
    customerName: string | null;
    birthYear: string | null;
    membershipBranchId: string | null;
  })[]
> {
  const users = await User.byIds(rows.map((row) => row.customerId));
  return rows.map((row) => {
    const user = row.customerId === null ? undefined : users.get(row.customerId);
    return {
      ...row,
      customerName: user?.name ?? null,
      birthYear: user?.dob ? String(user.dob.year) : null,
      membershipBranchId: user?.branchMembershipId ?? null,
    };
  });
}

/** The membership branch lives in Postgres: the rows carry its id and the name is joined here. */
async function withMembershipBranchNames<Row extends { membershipBranchId: string | null }>(
  rows: Row[],
): Promise<(Omit<Row, "membershipBranchId"> & { membershipBranchName: string | null })[]> {
  const names = await Branch.namesByIds(rows.map((row) => row.membershipBranchId));
  return rows.map(({ membershipBranchId, ...row }) => ({
    ...row,
    membershipBranchName:
      membershipBranchId === null ? null : (names.get(membershipBranchId) ?? null),
  }));
}

/**
 * Titles come from the Postgres catalogue. Books referencing a deleted item keep counting in the
 * summary (bulk updates addressed by deadline include them either way), under a placeholder title.
 */
async function withTitles(rows: Omit<SummaryRow, "title">[]): Promise<SummaryRow[]> {
  const titles = await Item.titlesByIds(rows.map((row) => row.itemId));
  return rows.map((row) => ({ ...row, title: titles.get(row.itemId) ?? "Ukjent bok" }));
}

/**
 * The ordered books (open lines with a deadline) on placed orders of the given branches, as a
 * query over `order_items` joined with `orders`, narrowed by the bulk filter.
 */
function orderedBooksQuery(
  branchIds: string[],
  filter: { deadlines?: string[]; itemId?: string; orderItemIds?: number[] } = {},
) {
  const query = OrderItem.whereOpen(
    db.from("order_items").join("orders", "orders.id", "order_items.order_id"),
    LOAN_ORDER_ITEM_TYPES,
  )
    .where("orders.placed", true)
    .whereIn("orders.branch_id", branchIds)
    .whereNotNull("order_items.period_to");
  if (filter.deadlines) {
    void query.whereIn(
      "order_items.period_to",
      filter.deadlines.map((deadline) => new Date(deadline)),
    );
  }
  if (filter.itemId) {
    void query.where("order_items.item_id", filter.itemId);
  }
  if (filter.orderItemIds) {
    void query.whereIn("order_items.id", filter.orderItemIds);
  }
  return query;
}

export const BranchBooksService = {
  clusterDeadlines,

  async getActiveBooksSummary(branchId: string): Promise<BranchBooksSummary> {
    const { scopeIds } = await resolveScope(branchId);
    const rows: { deadline: Date; itemId: string; direct: string; total: string }[] =
      await activeBooksQuery(scopeIds)
        .groupBy("customer_items.deadline", "customer_items.item_id")
        .select("customer_items.deadline", "customer_items.item_id as itemId")
        .select(
          db.raw("count(*) filter (where customer_items.handout_branch_id = ?) as direct", [
            branchId,
          ]),
        )
        .count("* as total");
    return buildSummary(
      await withTitles(
        rows.map((row) => ({
          deadline: row.deadline,
          itemId: row.itemId,
          direct: Number(row.direct),
          total: Number(row.total),
        })),
      ),
    );
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
    const rows: {
      customerItemId: string;
      customerId: string | null;
      blid: string | null;
      handoutTime: Date | null;
    }[] = await activeBooksQuery([branchId])
      .where("customer_items.item_id", itemId)
      .whereIn(
        "customer_items.deadline",
        deadlines.map((deadline) => new Date(deadline)),
      )
      .orderBy("customer_items.handed_out_at")
      .select(
        "customer_items.id as customerItemId",
        "customer_items.customer_id as customerId",
        "customer_items.blid",
        "customer_items.handed_out_at as handoutTime",
      );
    return (await withMembershipBranchNames(await withCustomerColumns(rows))).map(
      ({ handoutTime, ...row }) =>
        Object.assign(row, { handoutTime: handoutTime ? handoutTime.toISOString() : null }),
    );
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
    const { scopeIds } = await resolveScope(branchId);
    const query = activeBooksQuery(filter.includeDescendants ? scopeIds : [branchId]);
    if (filter.deadlines) {
      void query.whereIn(
        "customer_items.deadline",
        filter.deadlines.map((deadline) => new Date(deadline)),
      );
    }
    if (filter.itemId) {
      void query.where("customer_items.item_id", filter.itemId);
    }
    if (filter.customerItemIds) {
      void query.whereIn("customer_items.id", filter.customerItemIds);
    }
    const set: Record<string, unknown> = { updated_at: new Date() };
    if (update.deadline) {
      set["deadline"] = new Date(update.deadline);
    }
    if (update.branchId) {
      set["handout_branch_id"] = update.branchId;
    }
    const updated = Number(await query.update(set));
    return { matchedCount: updated, modifiedCount: updated };
  },

  async getOrderedBooksSummary(branchId: string): Promise<BranchBooksSummary> {
    const { scopeIds } = await resolveScope(branchId);
    const rows: { deadline: Date; itemId: string; direct: string; total: string }[] =
      await orderedBooksQuery(scopeIds)
        .groupBy("order_items.period_to", "order_items.item_id")
        .select("order_items.period_to as deadline", "order_items.item_id as itemId")
        .select(db.raw("count(*) filter (where orders.branch_id = ?) as direct", [branchId]))
        .count("* as total");
    return buildSummary(
      await withTitles(
        rows.map((row) => ({
          deadline: row.deadline,
          itemId: row.itemId,
          direct: Number(row.direct),
          total: Number(row.total),
        })),
      ),
    );
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
    const rows: {
      orderId: string;
      orderItemId: number;
      customerId: string | null;
      orderTime: Date;
    }[] = await orderedBooksQuery([branchId], { deadlines, itemId })
      .select(
        "orders.id as orderId",
        "order_items.id as orderItemId",
        "orders.customer_id as customerId",
        "orders.created_at as orderTime",
      )
      .orderBy("orders.created_at")
      .orderBy("order_items.id");
    return (await withMembershipBranchNames(await withCustomerColumns(rows))).map(
      ({ orderTime, ...row }) => Object.assign(row, { orderTime: orderTime.toISOString() }),
    );
  },

  async bulkUpdateOrderedBooks({
    branchId,
    filter,
    update,
  }: {
    branchId: string;
    filter: BranchBooksFilter & { orderItemIds?: number[] };
    update: BranchBooksUpdate;
  }) {
    const { scopeIds } = await resolveScope(branchId);
    const lines: { id: number; orderId: string }[] = await orderedBooksQuery(
      filter.includeDescendants ? scopeIds : [branchId],
      filter,
    ).select("order_items.id", "orders.id as orderId");
    if (lines.length === 0) {
      return { matchedCount: 0, modifiedCount: 0 };
    }
    const orderIds = [...new Set(lines.map((line) => line.orderId))];
    // The counts are orders, as they were when the lines were embedded in them.
    if (update.branchId) {
      const moved = await Order.query()
        .whereIn("id", orderIds)
        .whereNot("branchId", update.branchId)
        .update({ branchId: update.branchId, updatedAt: DateTime.now() });
      return { matchedCount: orderIds.length, modifiedCount: Number(moved[0] ?? 0) };
    }
    const deadline = DateTime.fromJSDate(new Date(update.deadline ?? ""));
    await db.transaction(async (trx) => {
      await OrderItem.query({ client: trx })
        .whereIn(
          "id",
          lines.map((line) => line.id),
        )
        .update({ periodTo: deadline });
      await Order.query({ client: trx })
        .whereIn("id", orderIds)
        .update({ updatedAt: DateTime.now() });
    });
    return { matchedCount: orderIds.length, modifiedCount: orderIds.length };
  },

  async bulkCancelOrderedBooks({
    branchId,
    filter,
    notifyCustomers,
    employeeDetailsId,
  }: {
    branchId: string;
    filter: BranchBooksFilter & { orderItemIds?: number[] };
    notifyCustomers: boolean;
    employeeDetailsId: string;
  }) {
    const { scopeIds } = await resolveScope(branchId);
    const lines: { orderId: string; itemId: string }[] = await orderedBooksQuery(
      filter.includeDescendants ? scopeIds : [branchId],
      filter,
    )
      .select("orders.id as orderId", "order_items.item_id as itemId")
      .orderBy("orders.id")
      .orderBy("order_items.position");
    const itemIdsByOrder = new Map<string, string[]>();
    for (const line of lines) {
      itemIdsByOrder.set(line.orderId, [...(itemIdsByOrder.get(line.orderId) ?? []), line.itemId]);
    }
    const orders = await Order.byIds(itemIdsByOrder.keys());
    const candidates = [...orders.values()].map((order) => ({
      order,
      cancelItems: (itemIdsByOrder.get(order.id) ?? []).map((itemId) => ({ itemId })),
    }));

    // Orders with money on them are skipped: cancelling those means refunds, which are handled manually
    const cancellable = candidates.filter(({ order }) => order.amount === 0);
    const skipped = candidates.filter(({ order }) => order.amount !== 0);
    for (const { order, cancelItems } of cancellable) {
      await OrderCancellationService.cancelOrderItems({
        originalOrder: order,
        orderItems: cancelItems,
        employeeDetailsId,
        notifyCustomer: notifyCustomers,
      });
    }
    return {
      cancelledOrders: cancellable.length,
      cancelledBooks: cancellable.reduce((sum, { cancelItems }) => sum + cancelItems.length, 0),
      skippedBooks: skipped.reduce((sum, { cancelItems }) => sum + cancelItems.length, 0),
    };
  },
};
