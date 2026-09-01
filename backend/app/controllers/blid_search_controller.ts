import type { HttpContext } from "@adonisjs/core/http";

import { BlidSearchService } from "#services/blid_search_service";
import { PermissionService } from "#services/permission_service";
import { blidActiveItemUpdateValidator } from "#validators/blid_search";

export default class BlidSearchController {
  async lookup(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    return BlidSearchService.lookup(ctx.request.param("blid"));
  }

  async updateActiveItem(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { customerItemId, deadline, branchId } = await ctx.request.validateUsing(
      blidActiveItemUpdateValidator,
    );
    if (!deadline && !branchId) {
      return ctx.response.badRequest();
    }
    await BlidSearchService.updateActiveItem({ customerItemId, deadline, branchId });
    return ctx.response.noContent();
  }
}
