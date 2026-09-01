import { StorageService } from "#services/storage_service";
import type { BlCollection } from "#types/bl-collection";

export const BranchItemCollection: BlCollection = {
  storage: StorageService.BranchItems,
  endpoints: [
    {
      method: "getId",
    },
    {
      method: "post",
      restriction: {
        permission: "admin",
      },
    },
    {
      method: "patch",
      restriction: {
        permission: "admin",
      },
    },
    {
      method: "getAll",
      validQueryParams: [
        { fieldName: "branch", type: "object-id" },
        { fieldName: "item", type: "expand" },
      ],
      nestedDocuments: [
        {
          field: "item",
          storage: StorageService.Items,
        },
      ],
    },
    {
      method: "delete",
      restriction: {
        permission: "admin",
      },
    },
  ],
};
