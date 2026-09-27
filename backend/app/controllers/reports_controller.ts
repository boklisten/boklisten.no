import type { HttpContext } from "@adonisjs/core/http";

import db from "@adonisjs/lucid/services/db";
import { ObjectId } from "mongodb";

import User from "#models/user";
import { OrderPayments } from "#services/payments/order_payments";
import { withBranchName, withItemColumns, withUserColumns } from "#services/report_columns";
import { StorageService } from "#services/storage_service";
import {
  customerItemsReportValidator,
  ordersReportValidator,
  paymentsReportValidator,
  usersReportValidator,
} from "#validators/report";

function dateRangeFilter(field: string, after: string | undefined, before: string | undefined) {
  const limiter: Record<string, Date> = {};
  if (after) {
    limiter["$gte"] = new Date(after);
  }
  if (before) {
    limiter["$lte"] = new Date(before);
  }
  return Object.keys(limiter).length > 0 ? { [field]: limiter } : {};
}

function branchFieldFilter(field: string, branchFilter: string[] | undefined) {
  return branchFilter && branchFilter.length > 0
    ? { [field]: { $in: branchFilter.map((id) => new ObjectId(id)) } }
    : {};
}

/** Keeps each Mongo `$in` list moderate when a report spans years of orders. */
const PAYMENT_LOOKUP_CHUNK_SIZE = 5000;

/** The orders among the given ones with at least one confirmed payment. */
async function confirmedPaymentOrderIds(orderIds: string[]): Promise<Set<string>> {
  const confirmed = new Set<string>();
  for (let start = 0; start < orderIds.length; start += PAYMENT_LOOKUP_CHUNK_SIZE) {
    const payments = await OrderPayments.byOrder(
      orderIds.slice(start, start + PAYMENT_LOOKUP_CHUNK_SIZE),
    );
    for (const [orderId, orderPayments] of payments) {
      if (orderPayments.some((payment) => payment.confirmed)) {
        confirmed.add(orderId);
      }
    }
  }
  return confirmed;
}

export default class ReportsController {
  async customerItems(ctx: HttpContext) {
    const {
      branchFilter,
      createdAfter,
      createdBefore,
      deadlineAfter,
      deadlineBefore,
      includeReturned,
      includeBuyout,
    } = await ctx.request.validateUsing(customerItemsReportValidator);

    const query = db.from("customer_items");
    if (branchFilter && branchFilter.length > 0) {
      void query.whereIn("handout_branch_id", branchFilter);
    }
    for (const [column, after, before] of [
      ["created_at", createdAfter, createdBefore],
      ["deadline", deadlineAfter, deadlineBefore],
    ] as const) {
      if (after) {
        void query.where(column, ">=", new Date(after));
      }
      if (before) {
        void query.where(column, "<=", new Date(before));
      }
    }
    if (!includeReturned) {
      void query.where("returned", false);
    }
    if (!includeBuyout) {
      void query.where("buyout", false);
    }
    // The branch, item, customer and employee ids are replaced by their Postgres columns in code,
    // in place, so the CSV keeps this column order.
    const rows: {
      id: string;
      handoutBranchId: string | null;
      handoutTime: Date;
      lastUpdated: Date;
      deadline: Date;
      returned: boolean;
      buyout: boolean;
      blid: string | null;
      itemId: string | null;
      customerId: string | null;
      handoutEmployeeId: string | null;
      pivot: string;
    }[] = await query
      .select(
        "id",
        "handout_branch_id as handoutBranchId",
        "handed_out_at as handoutTime",
        "updated_at as lastUpdated",
        "deadline",
        "returned",
        "buyout",
        "blid",
        "item_id as itemId",
        "customer_id as customerId",
        "handout_employee_id as handoutEmployeeId",
        db.raw("'1' as pivot"),
      )
      .orderBy("created_at")
      .orderBy("id");
    const withCustomer = await withUserColumns(rows, "customerId", (user) => ({
      name: user?.name ?? null,
      email: user?.email ?? null,
      phone: user?.phone ?? null,
      dob: user?.dob?.toISODate() ?? null,
      guardianEmail: user?.guardianEmail ?? null,
      guardianPhone: user?.guardianPhone ?? null,
      guardianName: user?.guardianName ?? null,
    }));
    const withEmployee = await withUserColumns(withCustomer, "handoutEmployeeId", (user) => ({
      handoutEmployee: user?.name ?? null,
    }));
    return withItemColumns(
      await withBranchName(withEmployee, "handoutBranchId", "handoutBranch"),
      (item) => ({
        title: item?.title ?? null,
        isbn: item === undefined ? null : String(item.isbn),
      }),
    );
  }

  async orders(ctx: HttpContext) {
    const { branchFilter, createdAfter, createdBefore } =
      await ctx.request.validateUsing(ordersReportValidator);

    const query = db
      .from("order_items")
      .join("orders", "orders.id", "order_items.order_id")
      .join("items", "items.id", "order_items.item_id")
      .where("orders.placed", true);
    if (branchFilter && branchFilter.length > 0) {
      void query.whereIn("orders.branch_id", branchFilter);
    }
    if (createdAfter) {
      void query.where("orders.created_at", ">=", new Date(createdAfter));
    }
    if (createdBefore) {
      void query.where("orders.created_at", "<=", new Date(createdBefore));
    }
    const lines: {
      orderId: string;
      orderAmount: number;
      branchId: string;
      employeeId: string | null;
      customerId: string | null;
      title: string;
      isbn: string | number;
      amount: number;
      type: string;
      creationTime: Date;
    }[] = await query
      .select(
        "orders.id as orderId",
        "orders.amount as orderAmount",
        "orders.branch_id as branchId",
        "orders.employee_id as employeeId",
        "orders.customer_id as customerId",
        "items.title",
        "items.isbn",
        "order_items.amount",
        "order_items.type",
        "orders.created_at as creationTime",
      )
      .orderBy("orders.created_at")
      .orderBy("order_items.position");

    // Payments stay in Mongo: an order is paid when it costs nothing or a confirmed payment is
    // recorded for it.
    const owingOrderIds = [
      ...new Set(lines.filter((line) => line.orderAmount !== 0).map((line) => line.orderId)),
    ];
    const confirmed = await confirmedPaymentOrderIds(owingOrderIds);
    const payed = (line: (typeof lines)[number]) =>
      line.orderAmount === 0 || confirmed.has(line.orderId);

    // The employee, customer and branch ids are replaced by their Postgres columns in code, in
    // place, so the CSV keeps this column order.
    const rows = lines.map((line) => ({
      ordreID: line.orderId,
      filialID: line.branchId,
      filialNavnId: line.branchId,
      employeeId: line.employeeId,
      customerId: line.customerId,
      title: line.title,
      ISBN: String(line.isbn),
      amount: line.amount,
      type: line.type,
      payed: payed(line),
      creationTime: line.creationTime,
      pivot: "1",
    }));
    const withEmployee = await withUserColumns(rows, "employeeId", (user) => ({
      employeeNavn: user?.name ?? null,
    }));
    const withCustomer = await withUserColumns(withEmployee, "customerId", (user) => ({
      customerName: user?.name ?? null,
    }));
    return withBranchName(withCustomer, "filialNavnId", "filialNavn");
  }

  async payments(ctx: HttpContext) {
    const { branchFilter, createdAfter, createdBefore } =
      await ctx.request.validateUsing(paymentsReportValidator);

    const rows = await StorageService.Payments.aggregate<{
      branchId: string | null;
      customerId: string | null;
    }>([
      {
        $match: {
          ...branchFieldFilter("branch", branchFilter),
          ...dateRangeFilter("creationTime", createdAfter, createdBefore),
        },
      },
      {
        $project: {
          _id: 0,
          id: { $toString: "$_id" },
          method: 1,
          amount: 1,
          confirmed: { $ifNull: ["$confirmed", false] },
          customerId: { $toString: "$customer" },
          branchId: { $toString: "$branch" },
          creationTime: 1,
          pivot: "1",
        },
      },
    ]);
    const withCustomer = await withUserColumns(rows, "customerId", (user) => ({
      customerName: user?.name ?? null,
    }));
    return withBranchName(withCustomer, "branchId", "branchName");
  }

  async users(ctx: HttpContext) {
    const { branchFilter } = await ctx.request.validateUsing(usersReportValidator);

    const query = User.query().orderBy("createdAt");
    if (branchFilter && branchFilter.length > 0) {
      void query.whereIn("branchMembershipId", branchFilter);
    }
    const rows = (await query).map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      address: user.address,
      postCity: user.postCity,
      postCode: user.postCode,
      dob: user.dob?.toISODate() ?? null,
      permission: user.permission,
      branchMembershipId: user.branchMembershipId,
      creationTime: user.createdAt?.toJSDate() ?? null,
      pivot: "1",
    }));
    return withBranchName(rows, "branchMembershipId", "branchMembership");
  }
}
