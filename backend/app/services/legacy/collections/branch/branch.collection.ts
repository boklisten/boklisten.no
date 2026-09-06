import { BranchGetHook } from "#services/legacy/collections/branch/hook/branch-get.hook";
import { StorageService } from "#services/storage_service";
import type { BlCollection } from "#types/bl-collection";

export const BranchCollection: BlCollection = {
  storage: StorageService.Branches,
  endpoints: [
    {
      method: "getId",
      hook: new BranchGetHook(),
      restriction: {
        permission: "employee",
      },
    },
    {
      method: "getAll",
      hook: new BranchGetHook(),
      restriction: {
        permission: "employee",
      },
    },
  ],
};
