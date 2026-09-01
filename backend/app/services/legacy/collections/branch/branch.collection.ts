import { BranchGetHook } from "#services/legacy/collections/branch/hook/branch-get.hook";
import { StorageService } from "#services/storage_service";
import type { BlCollection } from "#types/bl-collection";

export const BranchCollection: BlCollection = {
  storage: StorageService.Branches,
  endpoints: [
    {
      method: "getId",
      hook: new BranchGetHook(),
    },
    {
      method: "getAll",
      hook: new BranchGetHook(),
      validQueryParams: [
        {
          fieldName: "id",
          type: "string",
        },
        {
          fieldName: "name",
          type: "string",
        },
        {
          fieldName: "location.region",
          type: "string",
        },
        {
          fieldName: "location.bookable",
          type: "boolean",
        },
        {
          fieldName: "active",
          type: "boolean",
        },
        {
          fieldName: "isBranchItemsLive.online",
          type: "boolean",
        },
        {
          fieldName: "parentBranch",
          type: "string",
        },
        {
          fieldName: "location.address",
          type: "string",
        },
        {
          fieldName: "openingHours",
          type: "expand",
        },
        {
          fieldName: "type",
          type: "string",
        },
      ],
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
  ],
};
