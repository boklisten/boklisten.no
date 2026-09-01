import type { CustomerItem } from "#shared/customer-item/customer-item";

export class CustomerItemActive {
  public isActive(customerItem: CustomerItem): boolean {
    return !(
      customerItem.returned ||
      (customerItem.buyout ?? false) ||
      (customerItem.cancel ?? false) ||
      (customerItem.buyback ?? false)
    );
  }
}
