import type { HttpContext } from "@adonisjs/core/http";

import Branch from "#models/branch";
import type User from "#models/user";
import { inheritBelow } from "#services/branch_inheritance_service";
import { BranchScope } from "#services/branch_scope";
import { createBranch, updateBranch } from "#services/branch_service";
import { LoginService } from "#services/login_service";
import type { BranchSliceNode } from "#shared/branch";
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

  /** The tree customers walk down to find a stand's hours; see `Branch.openingHoursTree`. */
  indexOpeningHours() {
    return Branch.openingHoursTree();
  }

  /**
   * The caller's slice of the tree (`BranchScope.slice`), plus the one named by `include` (see
   * the validator), which is never selectable unless it was in the slice already.
   */
  async index(ctx: HttpContext): Promise<BranchSliceNode[]> {
    const { include } = await ctx.request.validateUsing(branchIndexValidator);
    const viewer = await optionalViewer(ctx);
    const rows: BranchSliceNode[] = [];
    for (const { branch, selectable } of await BranchScope.slice(viewer)) {
      rows.push({ ...branch.toDto(), selectable });
    }
    if (include !== undefined && !rows.some((row) => row.id === include)) {
      const included = await Branch.find(include);
      if (included !== null && mayBeShown(viewer, included)) {
        rows.push({ ...included.toDto(), selectable: false });
      }
    }
    return rows;
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
    await BranchScope.assertSelectableTarget(ctx.auth.getUserOrFail(), input.parentBranchId);
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

/**
 * The logged-in user on a route guests may also call. Tracked like any authenticated request, so a
 * session the remember-me cookie restores here is tagged and `SessionRevocationService` finds it.
 */
async function optionalViewer(ctx: HttpContext): Promise<User | null> {
  if (!(await ctx.auth.check())) {
    return null;
  }
  await LoginService.trackActivity(ctx);
  return ctx.auth.getUserOrFail();
}

/**
 * Whether `viewer` may be shown a branch they asked for by id: the root always, otherwise what
 * its visibility allows, plus the membership they hold, and for employees any branch at all, since
 * they look up the memberships of the customers they serve. Visibility governs the lists a branch
 * is picked from.
 */
function mayBeShown(viewer: User | null, branch: Branch): boolean {
  return (
    branch.isRoot ||
    canSeeBranch(viewer?.permission ?? null, branch.visibleToCustomers) ||
    (viewer !== null &&
      (hasPermissionLevel(viewer.permission, "employee") ||
        viewer.branchMembershipId === branch.id))
  );
}
