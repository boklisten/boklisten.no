import { StorageService } from "#services/storage_service";
import type { BlCollection } from "#types/bl-collection";

export const ItemCollection: BlCollection = {
  storage: StorageService.Items,
  endpoints: [
    {
      method: "getId",
      restriction: {
        permission: "employee",
      },
    },
    {
      method: "getAll",
      restriction: {
        permission: "employee",
      },
      validQueryParams: [
        { fieldName: "title", type: "string" },
        { fieldName: "type", type: "string" },
        { fieldName: "info.isbn", type: "number" },
        { fieldName: "active", type: "boolean" },
      ],
    },
  ],
};
