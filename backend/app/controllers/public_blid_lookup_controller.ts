import type { HttpContext } from "@adonisjs/core/http";

import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import type { PublicBlidLookupResult } from "#shared/public_blid_lookup";

export default class PublicBlidLookupController {
  async lookup(ctx: HttpContext) {
    PermissionService.authenticate(ctx);

    const blid = ctx.request.param("blid");

    return StorageService.CustomerItems.aggregate<PublicBlidLookupResult>([
      {
        $match: {
          returned: false,
          buyout: false,
          cancel: false,
          buyback: false,
          blid,
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
        $lookup: {
          from: "userdetails",
          localField: "customer",
          foreignField: "_id",
          as: "customerInfo",
        },
      },
      {
        $project: {
          handoutBranch: { $first: "$branchInfo.name" },
          handoutTime: "$handoutInfo.time",
          deadline: 1,
          title: { $first: "$itemInfo.title" },
          isbn: { $toString: { $first: "$itemInfo.info.isbn" } },
          name: { $first: "$customerInfo.name" },
          email: { $first: "$customerInfo.email" },
          phone: { $first: "$customerInfo.phone" },
        },
      },
    ]);
  }
}
