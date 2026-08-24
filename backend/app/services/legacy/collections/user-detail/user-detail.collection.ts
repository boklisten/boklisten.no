import { UserDetailUpdateHook } from "#services/legacy/collections/user-detail/hooks/user-detail-update.hook";
import { UserDetailReadPermissionOperation } from "#services/legacy/collections/user-detail/operations/read-permission/user-detail-read-permission.operation";
import { UserDetailValidOperation } from "#services/legacy/collections/user-detail/operations/user-detail-valid.operation";
import { StorageService } from "#services/storage_service";
import { BlCollection } from "#types/bl-collection";

export const UserDetailCollection: BlCollection = {
  storage: StorageService.UserDetails,
  documentPermission: {
    viewableForPermission: "employee",
  },
  endpoints: [
    {
      method: "getId",
      restriction: {
        permission: "customer",
        restricted: true,
      },
      operations: [
        {
          name: "valid",
          operation: new UserDetailValidOperation(),
          restriction: {
            permission: "customer",
            restricted: true,
          },
        },
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
        permission: "customer",
        restricted: true,
      },
    },
    {
      method: "getAll",
      validQueryParams: [
        {
          fieldName: "email",
          type: "string",
        },
        {
          fieldName: "branch",
          type: "object-id",
        },
        {
          fieldName: "name",
          type: "string",
        },
        {
          fieldName: "phone",
          type: "string",
        },
        {
          fieldName: "address",
          type: "string",
        },
        {
          fieldName: "postCity",
          type: "string",
        },
        {
          fieldName: "postCode",
          type: "string",
        },
        {
          fieldName: "_id",
          type: "object-id",
        },
      ],
      restriction: {
        permission: "employee",
      },
    },
  ],
};
