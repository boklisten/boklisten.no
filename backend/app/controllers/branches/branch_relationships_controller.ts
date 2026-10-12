import type { HttpContext } from "@adonisjs/core/http";

import Branch from "#models/branch";
import { BranchCycleError, updateBranchRelationships } from "#services/branch_service";
import { BranchScope } from "#services/branch_scope";
import { branchRelationshipValidator } from "#validators/branch";

export default class BranchRelationshipsController {
  async update(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(branchRelationshipValidator);
    // The branch itself is the one addressed; a new parent and newly added children are targets.
    // Unchanged values always pass: the form sends the parent back as it is, and for staff homed
    // at the branch that parent is above their scope.
    const viewer = ctx.auth.getUserOrFail();
    await BranchScope.assertSelectable(viewer, input.id);
    const branch = await Branch.findOrFail(input.id);
    if (input.parentBranchId !== undefined && input.parentBranchId !== branch.parentBranchId) {
      await BranchScope.assertSelectableTarget(viewer, input.parentBranchId);
    }
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
