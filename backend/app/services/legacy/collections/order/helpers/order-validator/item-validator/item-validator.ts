import { BlError } from "#shared/bl-error";
import type { Item } from "#shared/item";
import type { OrderItem } from "#shared/order/order-item/order-item";

export class ItemValidator {
  public validateItemInOrder(item: Item, orderItem: OrderItem): boolean {
    if (item.id != orderItem.item) {
      throw new BlError(`item.id "${item.id}" is not equal to orderItem.item "${orderItem.item}"`);
    }
    if (!item.active) {
      throw new BlError("item.active is false and cannot be in a order");
    }

    return true;
  }
}
