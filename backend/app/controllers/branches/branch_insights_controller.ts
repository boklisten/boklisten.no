import type { HttpContext } from "@adonisjs/core/http";

import { BranchInsightsService } from "#services/branch_insights_service";
import { PermissionService } from "#services/permission_service";

export default class BranchInsightsController {
  async getBookMovements(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    return BranchInsightsService.getBookMovements(ctx.request.param("branchId"));
  }
}
