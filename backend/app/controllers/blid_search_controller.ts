import type { HttpContext } from "@adonisjs/core/http";

import { BlidSearchService } from "#services/blid_search_service";
import { PermissionService } from "#services/permission_service";
import { blidActiveItemUpdateValidator, blidSearchQueryValidator } from "#validators/blid_search";

export default class BlidSearchController {
  async lookup(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    return BlidSearchService.lookup(ctx.request.param("blid"));
  }

  /** Books whose blid starts with the typed text, for the admin search field. */
  async search(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const { q } = await ctx.request.validateUsing(blidSearchQueryValidator);
    return BlidSearchService.search(q);
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
