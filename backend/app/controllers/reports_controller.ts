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

export default class ReportsController {
  async getCustomerItemsReport(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { branchFilter, createdAfter, createdBefore, deadlineAfter, deadlineBefore } =
      await ctx.request.validateUsing(customerItemsReportValidator);

    const filterByHandoutBranchIfPresent = branchFilter
      ? {
          "handoutInfo.handoutById": {
            $in: branchFilter.map((id) => new ObjectId(id)),
          },
        }
      : {};

    const creationTimeLimiter: Record<string, Date> = {};
    if (createdAfter) {
      creationTimeLimiter["$gte"] = new Date(createdAfter);
    }
    if (createdBefore) {
      creationTimeLimiter["$lte"] = new Date(createdBefore);
    }
    const creationTimeFilter =
      Object.keys(creationTimeLimiter).length > 0 ? { creationTime: creationTimeLimiter } : {};

    const deadlineLimiter: Record<string, Date> = {};
    if (deadlineAfter) {
      deadlineLimiter["$gte"] = new Date(deadlineAfter);
    }
    if (deadlineBefore) {
      deadlineLimiter["$lte"] = new Date(deadlineBefore);
    }
    const deadlineFilter =
      Object.keys(deadlineLimiter).length > 0 ? { deadline: deadlineLimiter } : {};

    return await StorageService.CustomerItems.aggregate([
      {
        $match: {
          ...filterByHandoutBranchIfPresent,
          ...creationTimeFilter,
          ...deadlineFilter,
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
          handoutBranch: { $first: "$branchInfo.name" },
          handoutTime: "$handoutInfo.time",
          lastUpdated: 1,
          deadline: 1,
          blid: 1,
          title: { $first: "$itemInfo.title" },
          isbn: { $toString: { $first: "$itemInfo.info.isbn" } },
          name: { $first: "$customerInfo.name" },
          email: { $first: "$customerInfo.email" },
          phone: { $first: "$customerInfo.phone" },
          dob: { $first: "$customerInfo.dob" },
          guardianEmail: { $first: "$customerInfo.guardian.email" },
          guardianPhone: { $first: "$customerInfo.guardian.phone" },
          guardianName: { $first: "$customerInfo.guardian.name" },
          handoutEmployee: { $first: "$employeeInfo.name" },
          pivot: "1",
        },
      },
    ]);
  }

  async getOrdersReport(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { branchFilter, createdAfter, createdBefore } =
      await ctx.request.validateUsing(ordersReportValidator);

    const filterByBranchIfPresent = branchFilter
      ? {
          branch: {
            $in: branchFilter.map((id) => new ObjectId(id)),
          },
        }
      : {};

    const creationTimeLimiter: Record<string, Date> = {};
    if (createdAfter) {
      creationTimeLimiter["$gte"] = new Date(createdAfter);
    }
    if (createdBefore) {
      creationTimeLimiter["$lte"] = new Date(createdBefore);
    }
    const creationTimeFilter =
      Object.keys(creationTimeLimiter).length > 0 ? { creationTime: creationTimeLimiter } : {};

    return await StorageService.Orders.aggregate([
      {
        $match: {
          placed: true,
          ...filterByBranchIfPresent,
          ...creationTimeFilter,
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
          ordreID: { $toString: "$_id" },
          filialID: { $toString: "$branch" },
          filialNavn: { $first: "$branchInfo.name" },
          employeeNavn: { $first: "$employeeInfo.name" },
          customerName: { $first: "$customerInfo.name" },
          title: "$orderItems.title",
          ISBN: { $toString: { $first: "$itemInfo.info.isbn" } },
          amount: "$orderItems.amount",
          type: "$orderItems.type",
          payed: {
            $and: [
              { $eq: ["$placed", true] },
              {
                $or: [
                  { $eq: ["$amount", 0] },
                  { $gt: [{ $size: { $ifNull: ["$payments", []] } }, 0] },
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

    const filterByBranchIfPresent = branchFilter
      ? {
          branch: {
            $in: branchFilter.map((id) => new ObjectId(id)),
          },
        }
      : {};

    const creationTimeLimiter: Record<string, Date> = {};
    if (createdAfter) {
      creationTimeLimiter["$gte"] = new Date(createdAfter);
    }
    if (createdBefore) {
      creationTimeLimiter["$lte"] = new Date(createdBefore);
    }
    const creationTimeFilter =
      Object.keys(creationTimeLimiter).length > 0 ? { creationTime: creationTimeLimiter } : {};

    return await StorageService.Payments.aggregate([
      {
        $match: {
          ...filterByBranchIfPresent,
          ...creationTimeFilter,
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
          id: { $toString: "$_id" },
          method: 1,
          amount: 1,
          customerName: { $first: "$customerInfo.name" },
          branchName: { $first: "$branchInfo.name" },
          creationTime: 1,
          pivot: "1",
        },
      },
    ]);
  }

  async getUserDetailsReport(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { branchFilter } = await ctx.request.validateUsing(userDetailsReportValidator);

    const filterByBranchMembershipIfPresent = branchFilter
      ? {
          branchMembership: {
            $in: branchFilter.map((id) => new ObjectId(id)),
          },
        }
      : {};

    return await StorageService.UserDetails.aggregate([
      {
        $match: {
          ...filterByBranchMembershipIfPresent,
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
        $project: {
          id: { $toString: "$_id" },
          email: 1,
          name: 1,
          phone: 1,
          address: 1,
          postCity: 1,
          postCode: 1,
          dob: 1,
          branchMembership: { $ifNull: [{ $first: "$branchInfo.name" }, null] },
          creationTime: 1,
          pivot: "1",
        },
      },
    ]);
  }
}
