import vine from "@vinejs/vine";
import { ObjectId } from "mongodb";

import { StorageService } from "#services/storage_service";
import { BlapiResponse } from "#shared/blapi-response";
import type { BlApiRequest } from "#types/bl-api-request";
import type { Operation } from "#types/operation";

const customerItemGenerateReportValidator = vine.object({
  branchFilter: vine.array(vine.string()).optional(),
  createdAfter: vine.string().optional(),
  createdBefore: vine.string().optional(),
  returned: vine.boolean(),
  buyout: vine.boolean(),
});

export class CustomerItemGenerateReportOperation implements Operation {
  async run(blApiRequest: BlApiRequest): Promise<BlapiResponse> {
    const { branchFilter, createdAfter, createdBefore, returned, buyout } = await vine.validate({
      schema: customerItemGenerateReportValidator,
      data: blApiRequest.data,
    });

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

    const reportData = await StorageService.CustomerItems.aggregate([
      {
        $match: {
          returned,
          buyout,
          ...filterByHandoutBranchIfPresent,
          ...creationTimeFilter,
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

    return new BlapiResponse(reportData);
  }
}
