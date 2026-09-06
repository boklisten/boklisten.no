import { CustomerItemActive } from "#services/customer_items/customer_item_active";
import { SEDbQuery } from "#models/mongoose/storage/db-query";
import { StorageService } from "#services/storage_service";
import type { CustomerItem } from "#shared/customer-item/customer-item";

export class CustomerItemActiveBlid {
  private readonly customerItemActive = new CustomerItemActive();
  /**
   * Checks if a blid is used by an active customerItem
   */
  async getActiveCustomerItemIds(blid: string): Promise<string[]> {
    const activeCustomerItems = await this.getActiveCustomerItems(blid);
    return activeCustomerItems.map((customerItem) => customerItem.id);
  }

  async getActiveCustomerItems(blid: string): Promise<CustomerItem[]> {
    const databaseQuery = new SEDbQuery();
    databaseQuery.stringFilters = [{ fieldName: "blid", value: blid }];

    const customerItems = await StorageService.CustomerItems.getByQuery(databaseQuery);

    const activeCustomerItems = customerItems.filter((customerItem) =>
      this.customerItemActive.isActive(customerItem),
    );

    if (!activeCustomerItems || activeCustomerItems.length <= 0) {
      return [];
    }

    return activeCustomerItems;
  }
}
