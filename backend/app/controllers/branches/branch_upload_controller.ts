import { HttpContext } from "@adonisjs/core/http";

import { BranchRelationshipService } from "#services/branch_relationship_service";
import { SEDbQuery } from "#services/legacy/query/se.db-query";
import { isNullish } from "#services/legacy/typescript-helpers";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import { BranchItem } from "#shared/branch-item";
import { Item } from "#shared/item";
import { UserDetail } from "#shared/user-detail";
import { branchMembershipValidator } from "#validators/branch_membership";
import { subjectChoicesValidator } from "#validators/subject_choices";

function findBranch(branch: string, branches: { id: string; name: string }[]) {
  return branches.find((candidate) =>
    candidate.name
      .replaceAll(" ", "")
      .toLowerCase()
      .includes(branch.replaceAll(" ", "").toLowerCase()),
  );
}

async function applyMembershipData(
  branchId: string,
  membershipData: { branch: string; phone: string }[],
) {
  const childBranches = await BranchRelationshipService.getLeafDescendants(branchId);

  const status = {
    unknownBranches: new Set<string>(),
    unknownRecords: [] as { phone: string; branch: string }[],
    matchedUsers: 0,
  };

  async function processMembership(membership: { branch: string; phone: string }) {
    const normalizedPhone = membership.phone.trim().slice(-8);
    const branch = findBranch(membership.branch, childBranches);
    if (!branch) {
      status.unknownBranches.add(membership.branch);
      return;
    }
    const result = await StorageService.UserDetails.updateMany(
      { phone: normalizedPhone },
      {
        branchMembership: branch.id,
      },
    );
    if (result.matchedCount === 0) {
      status.unknownRecords.push(membership);
    }
    status.matchedUsers += result.matchedCount;
  }

  await Promise.allSettled(membershipData.map((membership) => processMembership(membership)));

  return {
    ...status,
    unknownBranches: [...status.unknownBranches].sort((a, b) => a.localeCompare(b)),
    unknownRecords: status.unknownRecords.sort((a, b) => a.branch.localeCompare(b.branch)),
  };
}

type BranchItemWithRealItem = Omit<BranchItem, "item"> & { item: Item };
async function applySubjectChoices(
  branchId: string,
  subjectChoices: { phone: string; subjects: string[] }[],
) {
  const databaseQuery = new SEDbQuery();
  databaseQuery.objectIdFilters = [{ fieldName: "branch", value: branchId }];
  databaseQuery.expandFilters = [{ fieldName: "item" }];
  const branchItems = (await StorageService.BranchItems.getByQuery(databaseQuery, [
    { field: "item", storage: StorageService.Items },
  ])) as unknown as BranchItemWithRealItem[];
  const knownSubjects = Array.from(
    new Set<string>(branchItems.flatMap((branchItem) => branchItem.categories ?? [])),
  );

  const status = {
    unknownSubjects: new Set<string>(),
    unknownUsers: [] as { subjects: string[]; phone: string }[],
    successfulOrders: 0,
  };

  async function processSubjectChoice({ phone, subjects }: { phone: string; subjects: string[] }) {
    const normalizedPhone = phone.trim().slice(-8);
    const userDetailDatabaseQuery = new SEDbQuery();
    userDetailDatabaseQuery.stringFilters = [{ fieldName: "phone", value: normalizedPhone }];
    let userDetail: UserDetail;
    try {
      const [foundDetail] = await StorageService.UserDetails.getByQuery(userDetailDatabaseQuery);
      if (isNullish(foundDetail)) {
        status.unknownUsers.push({ phone, subjects });
        return;
      }
      userDetail = foundDetail;
    } catch {
      status.unknownUsers.push({ phone, subjects });
      return;
    }

    const filteredSubjects = subjects.filter((subject) => {
      if (knownSubjects.includes(subject)) {
        return true;
      }
      status.unknownSubjects.add(subject);
      return false;
    });
    const requestedBranchItems = filteredSubjects.flatMap((subject) =>
      branchItems.filter((branchItem) => branchItem.categories?.includes(subject)),
    );

    await StorageService.Orders.add({
      amount: 0,
      orderItems: requestedBranchItems.map((branchItem) => ({
        type: "rent",
        item: branchItem.item.id,
        title: branchItem.item.title,
        amount: 0,
        unitPrice: 0,
        delivered: false,
        info: {
          from: new Date(),
          to: new Date("2026-07-01"), // fixme: make customizable for future use
          numberOfPeriods: 1,
          periodType: "year",
        },
      })),
      branch: branchId,
      customer: userDetail.id,
      byCustomer: true,
      placed: true,
      payments: [],
      pendingSignature: false,
    });
    status.successfulOrders++;
  }

  await Promise.allSettled(
    subjectChoices.map((subjectChoice) => processSubjectChoice(subjectChoice)),
  );

  return {
    ...status,
    unknownSubjects: [...status.unknownSubjects].sort((a, b) => a.localeCompare(b)),
    unknownUsers: status.unknownUsers.sort((a, b) => a.phone.localeCompare(b.phone)),
  };
}

export default class BranchUploadController {
  async uploadMemberships(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);

    const { branchId, membershipData } = await ctx.request.validateUsing(branchMembershipValidator);
    return await applyMembershipData(branchId, membershipData);
  }

  async uploadSubjectChoices(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);

    const { branchId, subjectChoices } = await ctx.request.validateUsing(subjectChoicesValidator);
    return await applySubjectChoices(branchId, subjectChoices);
  }
}
