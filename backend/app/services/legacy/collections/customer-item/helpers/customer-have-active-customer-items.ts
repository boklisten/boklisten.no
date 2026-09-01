import { CustomerItemActive } from "#services/legacy/collections/customer-item/helpers/customer-item-active";
import { SEDbQueryBuilder } from "#services/legacy/query/se.db-query-builder";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { CustomerItem } from "#shared/customer-item/customer-item";

export class CustomerHaveActiveCustomerItems {
  private readonly queryBuilder = new SEDbQueryBuilder();
  private readonly customerItemActive = new CustomerItemActive();

  public async haveActiveCustomerItems(userId: string): Promise<boolean> {
    const databaseQuery = this.queryBuilder.getDbQuery({ customer: userId }, [
      { fieldName: "customer", type: "object-id" },
    ]);
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
