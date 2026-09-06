import { UserDetailUpdateHook } from "#services/legacy/collections/user-detail/hooks/user-detail-update.hook";
import { UserDetailReadPermissionOperation } from "#services/legacy/collections/user-detail/operations/read-permission/user-detail-read-permission.operation";
import { StorageService } from "#services/storage_service";
import type { BlCollection } from "#types/bl-collection";

export const UserDetailCollection: BlCollection = {
  storage: StorageService.UserDetails,
  endpoints: [
    {
      method: "getId",
      restriction: {
        permission: "employee",
      },
      operations: [
        {
          name: "permission",
          operation: new UserDetailReadPermissionOperation(),
          restriction: {
            permission: "admin",
          },
        },
      ],
    },
    {
      method: "patch",
      hook: new UserDetailUpdateHook(),
      restriction: {
        permission: "employee",
      },
    },
    {
      method: "getAll",
      validQueryParams: [
        { fieldName: "email", type: "string" },
        { fieldName: "branch", type: "object-id" },
        { fieldName: "name", type: "string" },
        { fieldName: "phone", type: "string" },
        { fieldName: "address", type: "string" },
        { fieldName: "postCity", type: "string" },
        { fieldName: "postCode", type: "string" },
      ],
      restriction: {
        permission: "employee",
      },
    },
  ],
};
