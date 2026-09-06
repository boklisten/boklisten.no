import { StorageService } from "#services/storage_service";
import type { BlCollection } from "#types/bl-collection";

export const CompanyCollection: BlCollection = {
  storage: StorageService.Companies,
  endpoints: [
    {
      method: "getAll",
      restriction: {
        permission: "admin",
      },
    },
  ],
};
