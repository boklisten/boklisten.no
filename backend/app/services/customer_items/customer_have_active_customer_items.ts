import { CustomerItemActive } from "#services/customer_items/customer_item_active";
import { SEDbQuery } from "#models/mongoose/storage/db-query";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { CustomerItem } from "#shared/customer-item/customer-item";

export class CustomerHaveActiveCustomerItems {
  private readonly customerItemActive = new CustomerItemActive();

  public async haveActiveCustomerItems(userId: string): Promise<boolean> {
    const databaseQuery = new SEDbQuery();
    databaseQuery.objectIdFilters = [{ fieldName: "customer", value: userId }];
    let customerItems: CustomerItem[];

    try {
      customerItems = await StorageService.CustomerItems.getByQuery(databaseQuery);
    } catch (error) {
      if (error instanceof BlError && error.getCode() === 702) {
        return false;
      }
      throw error;
    }

    return customerItems.some((customerItem) => this.customerItemActive.isActive(customerItem));
  }
}
