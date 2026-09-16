import type { HttpContext } from "@adonisjs/core/http";

import { BranchItemsService } from "#services/branch_items_service";
import { branchItemsValidator } from "#validators/branch_items";

export default class BranchItemsController {
  /** Makes the branch's item list equal to the submitted one. */
  async update(ctx: HttpContext) {
    const branchId = ctx.request.param("branchId");
    const { branchItems } = await ctx.request.validateUsing(branchItemsValidator);
    await BranchItemsService.replace(branchId, branchItems);
  }

  async index(ctx: HttpContext) {
    return BranchItemsService.list(ctx.request.param("branchId"));
  }
}
