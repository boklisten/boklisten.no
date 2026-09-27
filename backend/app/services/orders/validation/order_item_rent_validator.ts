import type OrderItem from "#models/order_item";
import { OrderItemRentPeriodValidator } from "#services/orders/validation/order_item_rent_period_validator";
import { BlError } from "#shared/bl-error";
import type { Branch } from "#shared/branch";
import type { Item } from "#shared/item";

export class OrderItemRentValidator {
  private readonly orderItemRentPeriodValidator = new OrderItemRentPeriodValidator();

  public async validate(branch: Branch, orderItem: OrderItem, item: Item): Promise<boolean> {
    try {
      this.validateOrderItemInfoFields(orderItem);
      await this.orderItemRentPeriodValidator.validate(orderItem, branch, item.price);
      return true;
    } catch (error) {
      if (error instanceof BlError) {
        throw error;
      }
      throw new BlError("unknown error, could not validate orderItem type rent").store(
        "error",
        error,
      );
    }
  }

  private validateOrderItemInfoFields(orderItem: OrderItem): boolean {
    if (orderItem.periodTo === null) {
      throw new BlError('orderItem.periodTo is not set when orderItem.type is "rent"');
    }
    return true;
  }
}
