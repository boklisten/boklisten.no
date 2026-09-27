import type { HttpContext } from "@adonisjs/core/http";

import db from "@adonisjs/lucid/services/db";

import {
  customerItemsReportValidator,
  ordersReportValidator,
  paymentsReportValidator,
  usersReportValidator,
} from "#validators/report";

/**
 * Every report is one query; the columns are selected in the order the spreadsheet lists them,
 * since the frontend turns each row's keys into the header row.
 */
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

    const query = db
      .from("customer_items")
      .join("branches", "branches.id", "customer_items.handout_branch_id")
      .join("items", "items.id", "customer_items.item_id")
      .leftJoin("users as customers", "customers.id", "customer_items.customer_id")
      .leftJoin("users as employees", "employees.id", "customer_items.handout_employee_id");
    if (branchFilter && branchFilter.length > 0) {
      void query.whereIn("customer_items.handout_branch_id", branchFilter);
    }
    for (const [column, after, before] of [
      ["customer_items.created_at", createdAfter, createdBefore],
      ["customer_items.deadline", deadlineAfter, deadlineBefore],
    ] as const) {
      if (after) {
        void query.where(column, ">=", new Date(after));
      }
      if (before) {
        void query.where(column, "<=", new Date(before));
      }
    }
    if (!includeReturned) {
      void query.where("customer_items.returned", false);
    }
    if (!includeBuyout) {
      void query.where("customer_items.buyout", false);
    }
    const rows: {
      id: string;
      handoutBranch: string;
      handoutTime: Date;
      lastUpdated: Date;
      deadline: Date;
      returned: boolean;
      buyout: boolean;
      blid: string | null;
      title: string;
      isbn: string;
      name: string | null;
      email: string | null;
      phone: string | null;
      dob: string | null;
      guardianEmail: string | null;
      guardianPhone: string | null;
      guardianName: string | null;
      handoutEmployee: string | null;
      pivot: string;
    }[] = await query
      .select(
        "customer_items.id",
        "branches.name as handoutBranch",
        "customer_items.handed_out_at as handoutTime",
        "customer_items.updated_at as lastUpdated",
        "customer_items.deadline",
        "customer_items.returned",
        "customer_items.buyout",
        "customer_items.blid",
        "items.title",
        db.raw("items.isbn::text as isbn"),
        "customers.name",
        "customers.email",
        "customers.phone",
        db.raw(`to_char(customers.dob, 'YYYY-MM-DD') as dob`),
        "customers.guardian_email as guardianEmail",
        "customers.guardian_phone as guardianPhone",
        "customers.guardian_name as guardianName",
        "employees.name as handoutEmployee",
        db.raw("'1' as pivot"),
      )
      .orderBy("customer_items.created_at")
      .orderBy("customer_items.id");
    return rows;
  }

  async orders(ctx: HttpContext) {
    const { branchFilter, createdAfter, createdBefore } =
      await ctx.request.validateUsing(ordersReportValidator);

    const query = db
      .from("order_items")
      .join("orders", "orders.id", "order_items.order_id")
      .join("items", "items.id", "order_items.item_id")
      .join("branches", "branches.id", "orders.branch_id")
      .leftJoin("users as employees", "employees.id", "orders.employee_id")
      .leftJoin("users as customers", "customers.id", "orders.customer_id")
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
    const rows: {
      ordreID: string;
      filialID: string;
      filialNavn: string;
      employeeNavn: string | null;
      customerName: string | null;
      title: string;
      ISBN: string;
      amount: number;
      type: string;
      payed: boolean;
      creationTime: Date;
      pivot: string;
    }[] = await query
      .select(
        "orders.id as ordreID",
        "orders.branch_id as filialID",
        "branches.name as filialNavn",
        "employees.name as employeeNavn",
        "customers.name as customerName",
        "items.title",
        db.raw(`items.isbn::text as "ISBN"`),
        "order_items.amount",
        "order_items.type",
        // Paid when the order costs nothing or a confirmed payment is recorded for it.
        db.raw(
          `(orders.amount = 0 OR EXISTS (SELECT 1 FROM payments WHERE payments.order_id = orders.id AND payments.confirmed)) as payed`,
        ),
        "orders.created_at as creationTime",
        db.raw("'1' as pivot"),
      )
      .orderBy("orders.created_at")
      .orderBy("order_items.position");
    return rows;
  }

  async payments(ctx: HttpContext) {
    const { branchFilter, createdAfter, createdBefore } =
      await ctx.request.validateUsing(paymentsReportValidator);

    // A payment belongs to its order's customer and branch.
    const query = db
      .from("payments")
      .join("orders", "orders.id", "payments.order_id")
      .join("branches", "branches.id", "orders.branch_id")
      .leftJoin("users as customers", "customers.id", "orders.customer_id");
    if (branchFilter && branchFilter.length > 0) {
      void query.whereIn("orders.branch_id", branchFilter);
    }
    if (createdAfter) {
      void query.where("payments.created_at", ">=", new Date(createdAfter));
    }
    if (createdBefore) {
      void query.where("payments.created_at", "<=", new Date(createdBefore));
    }
    const rows: {
      id: string;
      method: string;
      amount: number;
      confirmed: boolean;
      customerName: string | null;
      branchName: string;
      creationTime: Date;
      pivot: string;
    }[] = await query
      .select(
        "payments.id",
        "payments.method",
        "payments.amount",
        "payments.confirmed",
        "customers.name as customerName",
        "branches.name as branchName",
        "payments.created_at as creationTime",
        db.raw("'1' as pivot"),
      )
      .orderBy("payments.created_at")
      .orderBy("payments.id");
    return rows;
  }

  async users(ctx: HttpContext) {
    const { branchFilter } = await ctx.request.validateUsing(usersReportValidator);

    const query = db
      .from("users")
      .leftJoin("branches", "branches.id", "users.branch_membership_id");
    if (branchFilter && branchFilter.length > 0) {
      void query.whereIn("users.branch_membership_id", branchFilter);
    }
    const rows: {
      id: string;
      email: string;
      name: string;
      phone: string | null;
      address: string;
      postCity: string;
      postCode: string;
      dob: string | null;
      permission: string;
      branchMembership: string | null;
      creationTime: Date | null;
      pivot: string;
    }[] = await query
      .select(
        "users.id",
        "users.email",
        "users.name",
        "users.phone",
        "users.address",
        "users.post_city as postCity",
        "users.post_code as postCode",
        db.raw(`to_char(users.dob, 'YYYY-MM-DD') as dob`),
        "users.permission",
        "branches.name as branchMembership",
        "users.created_at as creationTime",
        db.raw("'1' as pivot"),
      )
      .orderBy("users.created_at")
      .orderBy("users.id");
    return rows;
  }
}
