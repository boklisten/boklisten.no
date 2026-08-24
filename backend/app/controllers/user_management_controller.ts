import { HttpContext } from "@adonisjs/core/http";

import { PermissionService } from "#services/permission_service";
import { UserDuplicatesService } from "#services/user_duplicates_service";
import { UserManagementService } from "#services/user_management_service";
import { UserMetricsService } from "#services/user_metrics_service";
import { mergeUsersValidator, setPermissionValidator } from "#validators/user_management";

export default class UserManagementController {
  async metrics(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    return UserMetricsService.getMetrics();
  }

  async duplicates(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    return UserDuplicatesService.findDuplicateCustomers();
  }

  async merge(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { fromDetailsId, toDetailsId } = await ctx.request.validateUsing(mergeUsersValidator);
    await UserManagementService.mergeUsers(fromDetailsId, toDetailsId);
    return { merged: true };
  }

  async destroy(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    await UserManagementService.deleteUser(ctx.request.param("detailsId"));
    return { deleted: true };
  }

  async employees(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    return UserManagementService.getEmployees();
  }

  async setPermission(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { detailsIds, permission } = await ctx.request.validateUsing(setPermissionValidator);
    return UserManagementService.setPermission(detailsIds, permission);
  }
}
