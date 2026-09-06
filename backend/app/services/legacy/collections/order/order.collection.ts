import { OrderPatchHook } from "#services/legacy/collections/order/hooks/order.patch.hook";
import { OrderPostHook } from "#services/legacy/collections/order/hooks/order.post.hook";
import { OrderConfirmOperation } from "#services/legacy/collections/order/operations/confirm/order-confirm.operation";
import { OrderPlaceOperation } from "#services/legacy/collections/order/operations/place/order-place.operation";
import { StorageService } from "#services/storage_service";
import type { BlCollection } from "#types/bl-collection";

export const OrderCollection: BlCollection = {
  storage: StorageService.Orders,
  endpoints: [
    {
      method: "post",
      hook: new OrderPostHook(),
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
    {
      method: "patch",
      hook: new OrderPatchHook(),
      restriction: {
        permission: "employee",
      },
      operations: [
        {
          name: "place",
          operation: new OrderPlaceOperation(),
          restriction: {
            permission: "employee",
          },
        },
        {
          name: "confirm",
          operation: new OrderConfirmOperation(),
          restriction: {
            permission: "employee",
          },
        },
      ],
    },
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
        { fieldName: "placed", type: "boolean" },
        { fieldName: "byCustomer", type: "boolean" },
        { fieldName: "branch", type: "string" },
        { fieldName: "creationTime", type: "date" },
        { fieldName: "customer", type: "object-id" },
      ],
    },
  ],
};
