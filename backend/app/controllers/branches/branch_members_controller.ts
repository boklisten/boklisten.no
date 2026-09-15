import type { HttpContext } from "@adonisjs/core/http";
import moment from "moment";

import { BranchRelationshipService } from "#services/branch_relationship_service";
import { SEDbQuery } from "#models/mongoose/storage/db-query";
import { StorageService } from "#services/storage_service";
import { updateBranchMembershipValidator } from "#validators/branch_membership";

async function getMembers(branchId: string) {
  const databaseQuery = new SEDbQuery();
  databaseQuery.objectIdFilters = [{ fieldName: "branchMembership", value: branchId }];
  return (await StorageService.UserDetails.getByQueryOrNull(databaseQuery)) ?? [];
}

export default class BranchMembersController {
  async index(ctx: HttpContext) {
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
  async update(ctx: HttpContext) {
    const { branchMembership, detailsId } = await ctx.request.validateUsing(
      updateBranchMembershipValidator,
    );
    await StorageService.UserDetails.update(detailsId, {
      branchMembership,
    });
  }
  async destroyDirect(ctx: HttpContext) {
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
  async destroyIndirect(ctx: HttpContext) {
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
