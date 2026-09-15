import type { HttpContext } from "@adonisjs/core/http";

import { StorageService } from "#services/storage_service";
import { branchCreateValidator, branchValidator } from "#validators/branch";
import { SEDbQuery } from "#models/mongoose/storage/db-query";

export default class BranchesController {
  async indexPublic() {
    const databaseQuery = new SEDbQuery();
    databaseQuery.booleanFilters = [{ fieldName: "active", value: true }];
    databaseQuery.booleanFilters = [{ fieldName: "isBranchItemsLive.online", value: true }];
    databaseQuery.sortFilters = [{ fieldName: "name", direction: 1 }];
    return StorageService.Branches.getByQuery(databaseQuery);
  }
  async index() {
    const databaseQuery = new SEDbQuery();
    databaseQuery.sortFilters = [{ fieldName: "name", direction: 1 }];
    return StorageService.Branches.getByQuery(databaseQuery);
  }
  async show(ctx: HttpContext) {
    const branchId = ctx.request.param("branchId");
    return StorageService.Branches.getOrNull(branchId);
  }
  async store(ctx: HttpContext) {
    const branchData = await ctx.request.validateUsing(branchCreateValidator);
    return StorageService.Branches.add(branchData);
  }
  async update(ctx: HttpContext) {
    const branchData = await ctx.request.validateUsing(branchValidator);
    return StorageService.Branches.update(ctx.request.param("branchId"), branchData);
  }
}
