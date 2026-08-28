import { HttpContext } from "@adonisjs/core/http";
import moment from "moment";

import { BranchRelationshipService } from "#services/branch_relationship_service";
import { SEDbQuery } from "#services/legacy/query/se.db-query";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import { updateBranchMembershipValidator } from "#validators/branch_membership";

async function getMembers(branchId: string) {
  const databaseQuery = new SEDbQuery();
  databaseQuery.objectIdFilters = [{ fieldName: "branchMembership", value: branchId }];
  return (await StorageService.UserDetails.getByQueryOrNull(databaseQuery)) ?? [];
}

export default class BranchMembershipController {
  async getMembers(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const branchId = ctx.request.param("branchId");
    const directMembers = await getMembers(branchId);
    const childBranchIds = await BranchRelationshipService.getNestedChildBranchIds(branchId);
    const indirectMembers = (
      await Promise.all(childBranchIds.map((childId) => getMembers(childId)))
    ).flat();
    return {
      directMembers: directMembers
        .map((member) => ({
          id: member.id,
          name: member.name,
          yearOfBirth: moment(member.dob).format("YYYY"),
        }))
        .toSorted((a, b) => a.name.localeCompare(b.name)),
      indirectMembers: {
        count: indirectMembers.length,
      },
    };
  }
  async updateMembership(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { branchMembership, detailsId } = await ctx.request.validateUsing(
      updateBranchMembershipValidator,
    );
    await StorageService.UserDetails.update(detailsId, {
      branchMembership,
    });
  }
  async removeDirectMembers(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const branchId = ctx.request.param("branchId");
    const directMembers = await getMembers(branchId);
    await Promise.all(
      directMembers.map((member) =>
        StorageService.UserDetails.update(member.id, {
          branchMembership: null,
        }),
      ),
    );
  }
  async removeIndirectMembers(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const branchId = ctx.request.param("branchId");
    const childBranchIds = await BranchRelationshipService.getNestedChildBranchIds(branchId);
    const allMembers = (
      await Promise.all(childBranchIds.map((childId) => getMembers(childId)))
    ).flat();
    await Promise.all(
      allMembers.map((member) =>
        StorageService.UserDetails.update(member.id, {
          branchMembership: null,
        }),
      ),
    );
  }
}
