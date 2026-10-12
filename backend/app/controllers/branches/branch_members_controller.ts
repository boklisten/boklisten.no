import type { HttpContext } from "@adonisjs/core/http";

import Branch from "#models/branch";
import User from "#models/user";
import { BranchMembershipService } from "#services/branch_membership_service";
import { BranchScope } from "#services/branch_scope";
import { assertMembershipAllowed } from "#services/user_service";
import {
  branchMembersPageValidator,
  updateBranchMembershipValidator,
} from "#validators/branch_membership";

export default class BranchMembersController {
  /** One page of the members of a branch, or of the members of the branches below it. */
  async index(ctx: HttpContext) {
    const { scope, cursor, limit } = await ctx.request.validateUsing(branchMembersPageValidator);
    const branch = await Branch.findOrFail(ctx.request.param("branchId"));
    return BranchMembershipService.getPage(branch.id, {
      scope,
      // An infinite query sends an empty cursor for the first page
      cursor: cursor === "" ? undefined : cursor,
      limit,
    });
  }
  async update(ctx: HttpContext) {
    const { branchMembership, userId } = await ctx.request.validateUsing(
      updateBranchMembershipValidator,
    );
    const actor = ctx.auth.getUserOrFail();
    await BranchScope.assertCustomerInScope(actor, userId);
    const user = await User.findOrFail(userId);
    await assertMembershipAllowed(actor, user.branchMembershipId, branchMembership);
    user.branchMembershipId = branchMembership;
    await user.save();
  }
  async destroyDirect(ctx: HttpContext) {
    await BranchMembershipService.moveMembersToRoot(ctx.request.param("branchId"), "direct");
  }
  async destroyIndirect(ctx: HttpContext) {
    await BranchMembershipService.moveMembersToRoot(ctx.request.param("branchId"), "indirect");
  }
}
