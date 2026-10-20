import type { HttpContext } from "@adonisjs/core/http";

import Branch from "#models/branch";
import { BranchCycleError, updateBranchRelationships } from "#services/branch_service";
import { BranchScope } from "#services/branch_scope";
import { branchRelationshipValidator } from "#validators/branch";

export default class BranchRelationshipsController {
  async update(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(branchRelationshipValidator);
    // The branch itself is the one addressed; newly added children are targets. The current ones
    // always pass, since the form sends them back as they are.
    const viewer = ctx.auth.getUserOrFail();
    await BranchScope.assertSelectable(viewer, input.id);
    if (input.childBranchIds !== undefined) {
      const current = new Set(
        (await Branch.query().where("parentBranchId", input.id)).map((child) => child.id),
      );
      for (const childId of input.childBranchIds.filter((id) => !current.has(id))) {
        await BranchScope.assertSelectableTarget(viewer, childId);
      }
    }
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
