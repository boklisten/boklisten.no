import type { HttpContext } from "@adonisjs/core/http";

import { BlidSearchService } from "#services/blid_search_service";
import { PermissionService } from "#services/permission_service";
import { UniqueItemEditService } from "#services/unique_item_edit_service";
import {
  blidActiveItemUpdateValidator,
  blidRelinkValidator,
  blidSearchQueryValidator,
} from "#validators/blid_search";

export default class BlidSearchController {
  async lookup(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    return BlidSearchService.lookup(ctx.request.param("blid"));
  }

  /** Books whose blid contains the typed text, for the admin search field. */
  async search(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const { q } = await ctx.request.validateUsing(blidSearchQueryValidator);
    return BlidSearchService.search(q);
  }

  async updateActiveItem(ctx: HttpContext) {
    const employee = PermissionService.employeeOrFail(ctx);
    const { customerItemId, deadline, branchId } = await ctx.request.validateUsing(
      blidActiveItemUpdateValidator,
    );
    if (!deadline && !branchId) {
      return ctx.response.badRequest();
    }
    await BlidSearchService.updateActiveItem({ customerItemId, deadline, branchId }, employee);
    return ctx.response.noContent();
  }

  /** Points the blid, and the customer items carrying it, at another book. */
  async relink(ctx: HttpContext) {
    const employee = PermissionService.employeeOrFail(ctx);
    const { itemId } = await ctx.request.validateUsing(blidRelinkValidator);
    await UniqueItemEditService.relink({ blid: ctx.request.param("blid"), itemId }, employee);
    return ctx.response.noContent();
  }

  /** Deletes the blid; refused while a customer holds the book. */
  async remove(ctx: HttpContext) {
    const employee = PermissionService.employeeOrFail(ctx);
    await UniqueItemEditService.remove({ blid: ctx.request.param("blid") }, employee);
    return ctx.response.noContent();
  }
}
