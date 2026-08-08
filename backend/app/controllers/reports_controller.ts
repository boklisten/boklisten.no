import { HttpContext } from "@adonisjs/core/http";

import { ObjectId } from "mongodb";
import { PermissionService } from "#services/permission_service";
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
  async getCustomerItemsReport(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const {
      branchFilter,
      createdAfter,
      createdBefore,
      deadlineAfter,
      deadlineBefore,
      includeReturned,
      includeBuyout,
    } = await ctx.request.validateUsing(customerItemsReportValidator);

    return await StorageService.CustomerItems.aggregate([
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
        $lookup: {
          from: "branches",
          localField: "handoutInfo.handoutById",
          foreignField: "_id",
          as: "branchInfo",
        },
      },
      {
        $lookup: {
          from: "items",
          localField: "item",
          foreignField: "_id",
          as: "itemInfo",
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
          handoutBranch: firstOrNull("$branchInfo.name"),
          handoutTime: "$handoutInfo.time",
          lastUpdated: 1,
          deadline: 1,
          returned: 1,
          buyout: 1,
          blid: 1,
          title: firstOrNull("$itemInfo.title"),
          isbn: { $toString: { $first: "$itemInfo.info.isbn" } },
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
  }

  async getOrdersReport(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { branchFilter, createdAfter, createdBefore } =
      await ctx.request.validateUsing(ordersReportValidator);

    return await StorageService.Orders.aggregate([
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
        $lookup: {
          from: "branches",
          localField: "branch",
          foreignField: "_id",
          as: "branchInfo",
        },
      },
      {
        $lookup: {
          from: "items",
          localField: "orderItems.item",
          foreignField: "_id",
          as: "itemInfo",
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
          filialNavn: firstOrNull("$branchInfo.name"),
          employeeNavn: firstOrNull("$employeeInfo.name"),
          customerName: firstOrNull("$customerInfo.name"),
          title: "$orderItems.title",
          ISBN: { $toString: { $first: "$itemInfo.info.isbn" } },
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
  }

  async getPaymentsReport(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { branchFilter, createdAfter, createdBefore } =
      await ctx.request.validateUsing(paymentsReportValidator);

    return await StorageService.Payments.aggregate([
      {
        $match: {
          ...branchFieldFilter("branch", branchFilter),
          ...dateRangeFilter("creationTime", createdAfter, createdBefore),
        },
      },
      {
        $lookup: {
          from: "branches",
          localField: "branch",
          foreignField: "_id",
          as: "branchInfo",
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
          branchName: firstOrNull("$branchInfo.name"),
          creationTime: 1,
          pivot: "1",
        },
      },
    ]);
  }

  async getUserDetailsReport(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { branchFilter } = await ctx.request.validateUsing(userDetailsReportValidator);

    return await StorageService.UserDetails.aggregate([
      {
        $match: {
          ...branchFieldFilter("branchMembership", branchFilter),
        },
      },
      {
        $lookup: {
          from: "branches",
          localField: "branchMembership",
          foreignField: "_id",
          as: "branchInfo",
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
          branchMembership: firstOrNull("$branchInfo.name"),
          creationTime: 1,
          pivot: "1",
        },
      },
    ]);
  }
}
