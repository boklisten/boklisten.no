import type { HttpContext } from "@adonisjs/core/http";

import Branch from "#models/branch";
import type User from "#models/user";
import { inheritBelow } from "#services/branch_inheritance_service";
import { createBranch, updateBranch } from "#services/branch_service";
import { canSeeBranch } from "#shared/branch-visibility";
import { hasPermissionLevel } from "#shared/user-permission";
import {
  branchCreateValidator,
  branchIndexValidator,
  branchInheritBelowValidator,
  branchValidator,
} from "#validators/branch";

export default class BranchesController {
  /** The tree customers walk down when ordering online; see `Branch.publicTree`. */
  indexPublic() {
    return Branch.publicTree();
  }

  /** The branches the caller may see, plus the one named by `include` (see the validator). */
  async index(ctx: HttpContext) {
    const { include } = await ctx.request.validateUsing(branchIndexValidator);
    const viewer = await optionalViewer(ctx);
    const branches = await Branch.visibleByName(viewer?.permission ?? null);
    if (include !== undefined && !branches.some((branch) => branch.id === include)) {
      const included = await Branch.find(include);
      if (included !== null && mayBeShown(viewer, included)) {
        branches.push(included);
      }
    }
    return branches.map((branch) => branch.toDto());
  }

  async show(ctx: HttpContext) {
    const [branch, viewer] = await Promise.all([
      Branch.find(String(ctx.request.param("branchId"))),
      optionalViewer(ctx),
    ]);
    return branch !== null && mayBeShown(viewer, branch) ? branch.toDto() : null;
  }

  async store(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(branchCreateValidator);
    return (await createBranch(input)).toDto();
  }

  async update(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(branchValidator);
    return (await updateBranch(String(ctx.request.param("branchId")), input)).toDto();
  }

  /** Every branch below inherits `field` again. */
  async inheritBelow(ctx: HttpContext) {
    const { field } = await ctx.request.validateUsing(branchInheritBelowValidator);
    const branchId = String(ctx.request.param("branchId"));
    await inheritBelow(branchId, field);
    return (await Branch.findOrFail(branchId)).toDto();
  }
}

/** The logged-in user on a route guests may also call. */
async function optionalViewer(ctx: HttpContext): Promise<User | null> {
  return (await ctx.auth.check()) ? ctx.auth.getUserOrFail() : null;
}

/**
 * Whether `viewer` may be shown a branch they asked for by id: what its visibility allows, plus
 * the membership they hold, and for employees any branch at all, since they look up the
 * memberships of the customers they serve. Visibility governs the lists a branch is picked from.
 */
function mayBeShown(viewer: User | null, branch: Branch): boolean {
  return (
    canSeeBranch(viewer?.permission ?? null, branch.visibility) ||
    (viewer !== null &&
      (hasPermissionLevel(viewer.permission, "employee") ||
        viewer.branchMembershipId === branch.id))
  );
}
