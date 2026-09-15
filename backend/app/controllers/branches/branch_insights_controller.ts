import type { HttpContext } from "@adonisjs/core/http";

import { BranchInsightsService } from "#services/branch_insights_service";

export default class BranchInsightsController {
  async getBookMovements(ctx: HttpContext) {
    return BranchInsightsService.getBookMovements(ctx.request.param("branchId"));
  }
}
