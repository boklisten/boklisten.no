import { UniqueItemActiveOperation } from "#services/legacy/collections/unique-item/operations/unique-item-active.operation";
import { StorageService } from "#services/storage_service";
import type { BlCollection } from "#types/bl-collection";

export const UniqueItemCollection: BlCollection = {
  storage: StorageService.UniqueItems,
  endpoints: [
    {
      method: "post",
      restriction: {
        permission: "employee",
      },
    },
    {
      method: "getId",
      operationsOnly: true,
      operations: [
        {
          name: "active",
          operation: new UniqueItemActiveOperation(),
          restriction: {
            permission: "employee",
          },
        },
      ],
    },
    {
      method: "getAll",
      restriction: {
        permission: "employee",
      },
      validQueryParams: [{ fieldName: "blid", type: "string" }],
    },
  ],
};
