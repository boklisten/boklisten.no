import { SEDbQuery } from "#models/mongoose/storage/db-query";
import { StorageService } from "#services/storage_service";

export const CustomerItemService = {
  async getCustomerItemByItemIdOrNull({
    customerId,
    itemId,
  }: {
    customerId: string;
    itemId: string;
  }) {
    const databaseQuery = new SEDbQuery();
    databaseQuery.objectIdFilters = [
      {
        fieldName: "item",
        value: itemId,
      },
      {
        fieldName: "customer",
        value: customerId,
      },
    ];
    databaseQuery.booleanFilters = [
      { fieldName: "returned", value: false },
      { fieldName: "buyout", value: false },
      { fieldName: "cancel", value: false },
    ];
    const [customerItem] =
      (await StorageService.CustomerItems.getByQueryOrNull(databaseQuery)) ?? [];
    return customerItem;
  },
};
