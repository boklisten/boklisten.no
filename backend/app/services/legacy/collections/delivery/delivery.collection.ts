import { DeliveryPostHook } from "#services/legacy/collections/delivery/hooks/delivery.post.hook";
import { StorageService } from "#services/storage_service";
import type { BlCollection } from "#types/bl-collection";

export const DeliveryCollection: BlCollection = {
  storage: StorageService.Deliveries,
  endpoints: [
    {
      method: "post",
      hook: new DeliveryPostHook(),
      restriction: {
        permission: "employee",
      },
    },
    {
      method: "getId",
      restriction: {
        permission: "employee",
      },
    },
  ],
};
