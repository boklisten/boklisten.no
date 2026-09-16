import type { HttpContext } from "@adonisjs/core/http";

import Item from "#models/item";
import { SEDbQuery } from "#models/mongoose/storage/db-query";
import { StorageService } from "#services/storage_service";
import { branchItemsValidator } from "#validators/branch_items";

export default class BranchItemsController {
  /** Replaces the branch's item list wholesale. */
  async update(ctx: HttpContext) {
    const databaseQuery = new SEDbQuery();
    const branchId = ctx.request.param("branchId");
    const { branchItems } = await ctx.request.validateUsing(branchItemsValidator);
    databaseQuery.objectIdFilters = [{ fieldName: "branch", value: branchId }];
    const existingBranchItems =
      (await StorageService.BranchItems.getByQueryOrNull(databaseQuery)) ?? [];
    await Promise.all(existingBranchItems.map((ebi) => StorageService.BranchItems.remove(ebi.id)));
    const newBranchItems = await Promise.all(
      branchItems.map((branchItem) =>
        StorageService.BranchItems.add({
          ...branchItem,
          branch: branchId,
          item: branchItem.item.id,
          categories: branchItem.subjects,
          sell: false,
          sellAtBranch: false,
          live: false,
          liveAtBranch: false,
        }),
      ),
    );
    await StorageService.Branches.update(
      branchId,
      newBranchItems.map((nbi) => nbi.id),
    );
  }
  async index(ctx: HttpContext) {
    const branchId = ctx.request.param("branchId");
    const databaseQuery = new SEDbQuery();
    databaseQuery.objectIdFilters = [{ fieldName: "branch", value: branchId }];
    const branchItems = (await StorageService.BranchItems.getByQueryOrNull(databaseQuery)) ?? [];

    return (
      await Promise.all(
        branchItems.map(async (branchItem) => {
          const item = await Item.findOrFail(branchItem.item);
          return {
            item: {
              id: item.id,
              title: item.title,
            },
            rent: branchItem.rent,
            rentAtBranch: branchItem.rentAtBranch,
            partlyPayment: branchItem.partlyPayment,
            partlyPaymentAtBranch: branchItem.partlyPaymentAtBranch,
            buy: branchItem.buy,
            buyAtBranch: branchItem.buyAtBranch,
            subjects: branchItem.categories,
          };
        }),
      )
    ).toSorted((a, b) => a.item.title.localeCompare(b.item.title));
  }
}
