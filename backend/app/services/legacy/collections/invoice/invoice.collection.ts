import { StorageService } from "#services/storage_service";
import type { BlCollection } from "#types/bl-collection";

export const InvoiceCollection: BlCollection = {
  storage: StorageService.Invoices,
  endpoints: [
    {
      method: "getId",
      restriction: {
        permission: "admin",
      },
    },
    {
      method: "getAll",
      restriction: {
        permission: "admin",
      },
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
