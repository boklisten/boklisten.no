import { PaymentPostHook } from "#services/legacy/collections/payment/hooks/payment.post.hook";
import { StorageService } from "#services/storage_service";
import type { BlCollection } from "#types/bl-collection";

export const PaymentCollection: BlCollection = {
  storage: StorageService.Payments,
  endpoints: [
    {
      method: "post",
      hook: new PaymentPostHook(),
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
        { fieldName: "confirmed", type: "boolean" },
        { fieldName: "creationTime", type: "date" },
        { fieldName: "branch", type: "string" },
        { fieldName: "method", type: "string" },
      ],
    },
    {
      method: "getId",
      restriction: {
        permission: "employee",
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
