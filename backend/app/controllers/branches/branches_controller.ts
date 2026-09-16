import type { HttpContext } from "@adonisjs/core/http";

import Branch from "#models/branch";
import { createBranch, updateBranch } from "#services/branch_service";
import { branchCreateValidator, branchValidator } from "#validators/branch";

export default class BranchesController {
  /** The branches customers may order from. */
  async indexPublic() {
    return (await Branch.publicByName()).map((branch) => branch.toDto());
  }

  async index() {
    return (await Branch.allByName()).map((branch) => branch.toDto());
  }

  async show(ctx: HttpContext) {
    const branch = await Branch.find(String(ctx.request.param("branchId")));
    return branch === null ? null : branch.toDto();
  }

  async store(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(branchCreateValidator);
    return (await createBranch(input)).toDto();
  }

  async update(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(branchValidator);
    return (await updateBranch(String(ctx.request.param("branchId")), input)).toDto();
  }
}
