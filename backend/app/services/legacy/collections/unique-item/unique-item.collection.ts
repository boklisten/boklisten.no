import { UniqueItemActiveOperation } from "#services/legacy/collections/unique-item/operations/unique-item-active.operation";
import { StorageService } from "#services/storage_service";
import type { BlCollection } from "#types/bl-collection";

export const UniqueItemCollection: BlCollection = {
  storage: StorageService.UniqueItems,
  documentPermission: {
    viewableForPermission: "employee",
  },
  endpoints: [
    {
      method: "post",
      restriction: {
        permission: "employee",
      },
    },
    {
      method: "getId",
      restriction: {
        permission: "employee",
      },
      operations: [
        {
          name: "active",
          operation: new UniqueItemActiveOperation(),
          /*
          restriction: {
            permissions: [""employee", "manager", "admin"]
          }
          */
        },
      ],
    },
    {
      method: "getAll",
      restriction: {
        permission: "employee",
      },
      validQueryParams: [
        { fieldName: "blid", type: "string" },
        { fieldName: "item", type: "object-id" },
      ],
    },
  ],
};
