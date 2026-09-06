import { StorageService } from "#services/storage_service";
import type { BlCollection } from "#types/bl-collection";

export const BranchItemCollection: BlCollection = {
  storage: StorageService.BranchItems,
  endpoints: [
    {
      method: "getAll",
      restriction: {
        permission: "admin",
      },
      validQueryParams: [{ fieldName: "branch", type: "object-id" }],
    },
  ],
};
