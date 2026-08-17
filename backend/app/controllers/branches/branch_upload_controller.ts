import { HttpContext } from "@adonisjs/core/http";

import { SEDbQuery } from "#services/legacy/query/se.db-query";
import { isNullish } from "#services/legacy/typescript-helpers";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import { BranchItem } from "#shared/branch-item";
import { Item } from "#shared/item";
import { UserDetail } from "#shared/user-detail";
import { subjectChoicesValidator } from "#validators/subject_choices";

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
  async uploadSubjectChoices(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);

    const { branchId, subjectChoices } = await ctx.request.validateUsing(subjectChoicesValidator);
    return await applySubjectChoices(branchId, subjectChoices);
  }
}
