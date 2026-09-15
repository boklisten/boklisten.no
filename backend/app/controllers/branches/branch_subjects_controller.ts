import type { HttpContext } from "@adonisjs/core/http";

import { BranchSubjectsService } from "#services/branch_subjects_service";
import { branchSubjectValidator } from "#validators/branch_subjects";

export default class BranchSubjectsController {
  async index(ctx: HttpContext) {
    return BranchSubjectsService.list(ctx.request.param("branchId"));
  }

  async store(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(branchSubjectValidator);
    await BranchSubjectsService.create(ctx.request.param("branchId"), input);
  }

  async update(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(branchSubjectValidator);
    await BranchSubjectsService.update(
      ctx.request.param("branchId"),
      Number(ctx.request.param("subjectId")),
      input,
    );
  }

  async destroy(ctx: HttpContext) {
    await BranchSubjectsService.destroy(
      ctx.request.param("branchId"),
      Number(ctx.request.param("subjectId")),
    );
  }

  async import(ctx: HttpContext) {
    return BranchSubjectsService.importFromBranchItems(ctx.request.param("branchId"));
  }
}
