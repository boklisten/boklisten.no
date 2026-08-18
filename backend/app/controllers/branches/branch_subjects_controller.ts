import { HttpContext } from "@adonisjs/core/http";

import { BranchSubjectsService } from "#services/branch_subjects_service";
import { PermissionService } from "#services/permission_service";
import { branchSubjectValidator } from "#validators/branch_subjects";

export default class BranchSubjectsController {
  async getSubjects(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    return BranchSubjectsService.list(ctx.request.param("branchId"));
  }

  async createSubject(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const input = await ctx.request.validateUsing(branchSubjectValidator);
    await BranchSubjectsService.create(ctx.request.param("branchId"), input);
  }

  async updateSubject(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const input = await ctx.request.validateUsing(branchSubjectValidator);
    await BranchSubjectsService.update(
      ctx.request.param("branchId"),
      Number(ctx.request.param("subjectId")),
      input,
    );
  }

  async deleteSubject(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    await BranchSubjectsService.destroy(
      ctx.request.param("branchId"),
      Number(ctx.request.param("subjectId")),
    );
  }

  async importSubjects(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    return BranchSubjectsService.importFromBranchItems(ctx.request.param("branchId"));
  }
}
