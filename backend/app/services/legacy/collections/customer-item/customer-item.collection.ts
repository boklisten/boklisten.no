import { CustomerItemGenerateReportOperation } from "#services/legacy/collections/customer-item/customer-item-generate-report.operation";
import { StorageService } from "#services/storage_service";
import type { BlCollection } from "#types/bl-collection";

export const CustomerItemCollection: BlCollection = {
  storage: StorageService.CustomerItems,
  endpoints: [
    {
      method: "getId",
      restriction: {
        permission: "employee",
      },
    },
    {
      method: "patch",
      restriction: {
        permission: "employee",
      },
    },
    {
      method: "post",
      operationsOnly: true,
      operations: [
        {
          name: "generate-report",
          operation: new CustomerItemGenerateReportOperation(),
          restriction: {
            permission: "admin",
          },
        },
      ],
    },
    {
      method: "getAll",
      restriction: {
        permission: "employee",
      },
      validQueryParams: [
        { fieldName: "deadline", type: "date" },
        { fieldName: "customer", type: "object-id" },
        { fieldName: "handoutInfo.handoutById", type: "string" },
        { fieldName: "returned", type: "boolean" },
        { fieldName: "type", type: "string" },
        { fieldName: "buyout", type: "boolean" },
        { fieldName: "cancel", type: "boolean" },
        { fieldName: "blid", type: "string" },
      ],
    },
  ],
};
