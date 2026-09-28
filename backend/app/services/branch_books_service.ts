import db from "@adonisjs/lucid/services/db";
import { DateTime } from "luxon";

import Branch from "#models/branch";
import CustomerItem from "#models/customer_item";
import User from "#models/user";
import Item from "#models/item";
import Order from "#models/order";
import OrderItem from "#models/order_item";
import { BranchRelationshipService } from "#services/branch_relationship_service";
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
  /** `YYYY-MM-DD`. */
  deadline: string;
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
  deadline?: string;
  itemId?: string;
  includeDescendants: boolean;
}

export interface BranchBooksUpdate {
  deadline?: string;
  branchId?: string;
}

export interface SummaryRow {
  /** `YYYY-MM-DD`. */
  deadline: string;
  itemId: string;
  title: string;
  direct: number;
  total: number;
}

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

export function buildSummary(rows: SummaryRow[]): BranchBooksSummary {
  const deadlines = [...new Set(rows.map((row) => row.deadline))].toSorted();
  const groups = deadlines.map((deadline) => {
    const titleById = new Map<string, BranchBooksTitle>();
    for (const row of rows.filter((candidate) => candidate.deadline === deadline)) {
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
      deadline,
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
  filter: { deadline?: string; itemId?: string; orderItemIds?: number[] } = {},
) {
  const query = OrderItem.whereOpen(
    db.from("order_items").join("orders", "orders.id", "order_items.order_id"),
    LOAN_ORDER_ITEM_TYPES,
  )
    .where("orders.placed", true)
    .whereIn("orders.branch_id", branchIds)
    .whereNotNull("order_items.period_to");
  if (filter.deadline) {
    void query.where("order_items.period_to", filter.deadline);
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
  async getActiveBooksSummary(branchId: string): Promise<BranchBooksSummary> {
    const { scopeIds } = await resolveScope(branchId);
    const rows: { deadline: string; itemId: string; direct: string; total: string }[] =
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
    deadline,
    itemId,
  }: {
    branchId: string;
    deadline: string;
    itemId: string;
  }) {
    const rows: {
      customerItemId: string;
      customerId: string | null;
      blid: string | null;
      handoutTime: Date | null;
    }[] = await activeBooksQuery([branchId])
      .where("customer_items.item_id", itemId)
      .where("customer_items.deadline", deadline)
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
    if (filter.deadline) {
      void query.where("customer_items.deadline", filter.deadline);
    }
    if (filter.itemId) {
      void query.where("customer_items.item_id", filter.itemId);
    }
    if (filter.customerItemIds) {
      void query.whereIn("customer_items.id", filter.customerItemIds);
    }
    const set: Record<string, unknown> = { updated_at: new Date() };
    if (update.deadline) {
      set["deadline"] = update.deadline;
    }
    if (update.branchId) {
      set["handout_branch_id"] = update.branchId;
    }
    const updated = Number(await query.update(set));
    return { matchedCount: updated, modifiedCount: updated };
  },

  async getOrderedBooksSummary(branchId: string): Promise<BranchBooksSummary> {
    const { scopeIds } = await resolveScope(branchId);
    const rows: { deadline: string; itemId: string; direct: string; total: string }[] =
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
    deadline,
    itemId,
  }: {
    branchId: string;
    deadline: string;
    itemId: string;
  }) {
    const rows: {
      orderId: string;
      orderItemId: number;
      customerId: string | null;
      orderTime: Date;
    }[] = await orderedBooksQuery([branchId], { deadline, itemId })
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
    const deadline = DateTime.fromISO(update.deadline ?? "");
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
    employeeId,
  }: {
    branchId: string;
    filter: BranchBooksFilter & { orderItemIds?: number[] };
    notifyCustomers: boolean;
    employeeId: string;
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
        employeeId,
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
