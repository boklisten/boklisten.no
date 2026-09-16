import type { HttpContext } from "@adonisjs/core/http";

import { BranchCycleError, updateBranchRelationships } from "#services/branch_service";
import { branchRelationshipValidator } from "#validators/branch";

export default class BranchRelationshipsController {
  async update(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(branchRelationshipValidator);
    try {
      return (await updateBranchRelationships(input)).toDto();
    } catch (error) {
      if (error instanceof BranchCycleError) {
        return ctx.response.conflict({ message: error.message });
      }
      throw error;
    }
  }
}
