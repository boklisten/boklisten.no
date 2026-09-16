import type { HttpContext } from "@adonisjs/core/http";

import { ObjectId } from "mongodb";
import { withBranchName, withItemColumns } from "#services/report_columns";
import { StorageService } from "#services/storage_service";
import {
  customerItemsReportValidator,
  ordersReportValidator,
  paymentsReportValidator,
  userDetailsReportValidator,
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

function firstOrNull(path: string) {
  return { $ifNull: [{ $first: path }, null] };
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
        $addFields: {
          customer: {
            $toObjectId: "$customer",
          },
        },
      },
      {
        $lookup: {
          from: "userdetails",
          localField: "customer",
          foreignField: "_id",
          as: "customerInfo",
        },
      },
      {
        $lookup: {
          from: "userdetails",
          localField: "handoutInfo.handoutEmployee",
          foreignField: "_id",
          as: "employeeInfo",
        },
      },
      {
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
          name: firstOrNull("$customerInfo.name"),
          email: firstOrNull("$customerInfo.email"),
          phone: firstOrNull("$customerInfo.phone"),
          dob: firstOrNull("$customerInfo.dob"),
          guardianEmail: firstOrNull("$customerInfo.guardian.email"),
          guardianPhone: firstOrNull("$customerInfo.guardian.phone"),
          guardianName: firstOrNull("$customerInfo.guardian.name"),
          handoutEmployee: firstOrNull("$employeeInfo.name"),
          pivot: "1",
        },
      },
    ]);
    return withItemColumns(
      await withBranchName(rows, "handoutBranchId", "handoutBranch"),
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
        $addFields: {
          customer: { $toObjectId: "$customer" },
        },
      },
      {
        $lookup: {
          from: "userdetails",
          localField: "customer",
          foreignField: "_id",
          as: "customerInfo",
        },
      },
      {
        $lookup: {
          from: "userdetails",
          localField: "employee",
          foreignField: "_id",
          as: "employeeInfo",
        },
      },
      {
        $project: {
          _id: 0,
          ordreID: { $toString: "$_id" },
          filialID: { $toString: "$branch" },
          filialNavnId: { $toString: "$branch" },
          employeeNavn: firstOrNull("$employeeInfo.name"),
          customerName: firstOrNull("$customerInfo.name"),
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
    return withItemColumns(await withBranchName(rows, "filialNavnId", "filialNavn"), (item) => ({
      ISBN: item === undefined ? null : String(item.isbn),
    }));
  }

  async payments(ctx: HttpContext) {
    const { branchFilter, createdAfter, createdBefore } =
      await ctx.request.validateUsing(paymentsReportValidator);

    const rows = await StorageService.Payments.aggregate<{ branchId: string | null }>([
      {
        $match: {
          ...branchFieldFilter("branch", branchFilter),
          ...dateRangeFilter("creationTime", createdAfter, createdBefore),
        },
      },
      {
        $addFields: {
          customer: { $toObjectId: "$customer" },
        },
      },
      {
        $lookup: {
          from: "userdetails",
          localField: "customer",
          foreignField: "_id",
          as: "customerInfo",
        },
      },
      {
        $project: {
          _id: 0,
          id: { $toString: "$_id" },
          method: 1,
          amount: 1,
          confirmed: { $ifNull: ["$confirmed", false] },
          customerName: firstOrNull("$customerInfo.name"),
          branchId: { $toString: "$branch" },
          creationTime: 1,
          pivot: "1",
        },
      },
    ]);
    return withBranchName(rows, "branchId", "branchName");
  }

  async userDetails(ctx: HttpContext) {
    const { branchFilter } = await ctx.request.validateUsing(userDetailsReportValidator);

    const rows = await StorageService.UserDetails.aggregate<{ branchMembershipId: string | null }>([
      {
        $match: {
          ...branchFieldFilter("branchMembership", branchFilter),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "userDetail",
          as: "userInfo",
        },
      },
      {
        $project: {
          _id: 0,
          id: { $toString: "$_id" },
          email: 1,
          name: 1,
          phone: 1,
          address: 1,
          postCity: 1,
          postCode: 1,
          dob: 1,
          permission: firstOrNull("$userInfo.permission"),
          branchMembershipId: { $toString: "$branchMembership" },
          creationTime: 1,
          pivot: "1",
        },
      },
    ]);
    return withBranchName(rows, "branchMembershipId", "branchMembership");
  }
}
