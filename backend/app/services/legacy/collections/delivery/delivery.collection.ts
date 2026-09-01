import { DeliveryPatchHook } from "#services/legacy/collections/delivery/hooks/delivery.patch.hook";
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
        permission: "customer",
      },
    },
    {
      method: "getAll",
      restriction: {
        permission: "admin",
        restricted: true,
      },
      validQueryParams: [
        {
          fieldName: "creationTime",
          type: "date",
        },
      ],
    },
    {
      method: "getId",
      restriction: {
        permission: "customer",
        restricted: true,
      },
    },
    {
      method: "patch",
      hook: new DeliveryPatchHook(),
      restriction: {
        permission: "customer",
        restricted: true,
      },
    },
    {
      method: "delete",
      restriction: {
        permission: "admin",
      },
    },
  ],
};
