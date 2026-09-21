import type { HttpContext } from "@adonisjs/core/http";

import User from "#models/user";
import { BranchRelationshipService } from "#services/branch_relationship_service";
import { updateBranchMembershipValidator } from "#validators/branch_membership";

export default class BranchMembersController {
  async index(ctx: HttpContext) {
    const branchId = ctx.request.param("branchId");
    const childBranchIds = await BranchRelationshipService.getNestedChildBranchIds(branchId);
    const [directMembers, indirectMemberCount] = await Promise.all([
      User.membersOf([branchId]).orderBy("name"),
      User.countMembersOf(childBranchIds),
    ]);
    return {
      directMembers: directMembers.map((member) => ({
        id: member.id,
        name: member.name,
        yearOfBirth: member.dob ? String(member.dob.year) : null,
      })),
      indirectMembers: {
        count: indirectMemberCount,
      },
    };
  }
  async update(ctx: HttpContext) {
    const { branchMembership, detailsId } = await ctx.request.validateUsing(
      updateBranchMembershipValidator,
    );
    const user = await User.findOrFail(detailsId);
    user.branchMembershipId = branchMembership;
    await user.save();
  }
  async destroyDirect(ctx: HttpContext) {
    const branchId = ctx.request.param("branchId");
    await User.membersOf([branchId]).update({ branchMembershipId: null });
  }
  async destroyIndirect(ctx: HttpContext) {
    const branchId = ctx.request.param("branchId");
    const childBranchIds = await BranchRelationshipService.getNestedChildBranchIds(branchId);
    if (childBranchIds.length > 0) {
      await User.membersOf(childBranchIds).update({ branchMembershipId: null });
    }
  }
}
