import type { HttpContext } from "@adonisjs/core/http";

import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import { branchCreateValidator, branchValidator } from "#validators/branch";
import { SEDbQuery } from "#services/legacy/query/se.db-query";

export default class BranchesController {
  async getPublic() {
    const databaseQuery = new SEDbQuery();
    databaseQuery.booleanFilters = [{ fieldName: "active", value: true }];
    databaseQuery.booleanFilters = [{ fieldName: "isBranchItemsLive.online", value: true }];
    databaseQuery.sortFilters = [{ fieldName: "name", direction: 1 }];
    return await StorageService.Branches.getByQuery(databaseQuery);
  }
  async getAll() {
    const databaseQuery = new SEDbQuery();
    databaseQuery.sortFilters = [{ fieldName: "name", direction: 1 }];
    return await StorageService.Branches.getByQuery(databaseQuery);
  }
  async getById(ctx: HttpContext) {
    const branchId = ctx.request.param("branchId");
    return await StorageService.Branches.getOrNull(branchId);
  }
  async add(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const branchData = await ctx.request.validateUsing(branchCreateValidator);
    return await StorageService.Branches.add(branchData);
  }
  async update(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const branchData = await ctx.request.validateUsing(branchValidator);
    if (!branchData?.id) {
      throw new Error("Id is required to update branch");
    }

    return await StorageService.Branches.update(branchData.id, branchData);
  }
}
