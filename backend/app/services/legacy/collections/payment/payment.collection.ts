import { PaymentGetAllHook } from "#services/legacy/collections/payment/hooks/payment.get-all.hook";
import { PaymentPostHook } from "#services/legacy/collections/payment/hooks/payment.post.hook";
import { StorageService } from "#services/storage_service";
import type { BlCollection } from "#types/bl-collection";

export const PaymentCollection: BlCollection = {
  storage: StorageService.Payments,
  documentPermission: {
    viewableForPermission: "employee",
  },
  endpoints: [
    {
      method: "post",
      hook: new PaymentPostHook(),
      restriction: {
        permission: "customer",
        restricted: true,
      },
    },
    {
      method: "getAll",
      hook: new PaymentGetAllHook(),
      restriction: {
        permission: "customer",
        restricted: true,
      },
      validQueryParams: [
        { fieldName: "confirmed", type: "boolean" },
        { fieldName: "creationTime", type: "date" },
        { fieldName: "branch", type: "string" },
        { fieldName: "method", type: "string" },
        { fieldName: "info.paymentId", type: "string" },
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
      method: "delete",
      restriction: {
        permission: "admin",
      },
    },
  ],
};
