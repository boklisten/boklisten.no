import type { HttpContext } from "@adonisjs/core/http";

import { ObjectId } from "mongodb";

import User from "#models/user";
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

    const rows = await StorageService.CustomerItems.aggregate<{
      handoutBranchId: string | null;
      itemId: string | null;
      customerId: string | null;
      handoutEmployeeId: string | null;
    }>([
      {
        $match: {
          ...branchFieldFilter("handoutInfo.handoutById", branchFilter),
          ...dateRangeFilter("creationTime", createdAfter, createdBefore),
          ...dateRangeFilter("deadline", deadlineAfter, deadlineBefore),
          ...(includeReturned ? {} : { returned: false }),
          ...(includeBuyout ? {} : { buyout: false }),
        },
      },
      {
        // The branch, item, customer and employee ids are replaced by their Postgres columns in
        // code, in place, so the CSV keeps this column order.
        $project: {
          _id: 0,
          id: { $toString: "$_id" },
          handoutBranchId: { $toString: "$handoutInfo.handoutById" },
          handoutTime: "$handoutInfo.time",
          lastUpdated: 1,
          deadline: 1,
          returned: 1,
          buyout: 1,
          blid: 1,
          itemId: { $toString: "$item" },
          customerId: { $toString: "$customer" },
          handoutEmployeeId: { $toString: "$handoutInfo.handoutEmployee" },
          pivot: "1",
        },
      },
    ]);
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

    const rows = await StorageService.Orders.aggregate<{
      filialNavnId: string | null;
      itemId: string | null;
      employeeId: string | null;
      customerId: string | null;
    }>([
      {
        $match: {
          placed: true,
          ...branchFieldFilter("branch", branchFilter),
          ...dateRangeFilter("creationTime", createdAfter, createdBefore),
        },
      },
      {
        $lookup: {
          from: "payments",
          let: {
            paymentIds: {
              $map: {
                input: { $ifNull: ["$payments", []] },
                as: "paymentId",
                in: { $convert: { input: "$$paymentId", to: "objectId", onError: null } },
              },
            },
          },
          pipeline: [
            { $match: { $expr: { $in: ["$_id", "$$paymentIds"] } } },
            { $project: { confirmed: 1 } },
          ],
          as: "paymentInfo",
        },
      },
      { $unwind: "$orderItems" },
      {
        $project: {
          _id: 0,
          ordreID: { $toString: "$_id" },
          filialID: { $toString: "$branch" },
          filialNavnId: { $toString: "$branch" },
          employeeId: { $toString: "$employee" },
          customerId: { $toString: "$customer" },
          title: "$orderItems.title",
          itemId: { $toString: "$orderItems.item" },
          amount: "$orderItems.amount",
          type: "$orderItems.type",
          payed: {
            $or: [
              { $eq: ["$amount", 0] },
              {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: "$paymentInfo",
                        as: "payment",
                        cond: { $eq: ["$$payment.confirmed", true] },
                      },
                    },
                  },
                  0,
                ],
              },
            ],
          },
          creationTime: 1,
          pivot: "1",
        },
      },
    ]);
    const withEmployee = await withUserColumns(rows, "employeeId", (user) => ({
      employeeNavn: user?.name ?? null,
    }));
    const withCustomer = await withUserColumns(withEmployee, "customerId", (user) => ({
      customerName: user?.name ?? null,
    }));
    return withItemColumns(
      await withBranchName(withCustomer, "filialNavnId", "filialNavn"),
      (item) => ({
        ISBN: item === undefined ? null : String(item.isbn),
      }),
    );
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
