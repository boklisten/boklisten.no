import { OrderItemRentPeriodValidator } from "#services/orders/validation/order_item_rent_period_validator";
import { isNullish } from "#services/typescript_helpers";
import { BlError } from "#shared/bl-error";
import type { Branch } from "#shared/branch";
import type { Item } from "#shared/item";
import type { OrderItem } from "#shared/order/order-item/order-item";

export class OrderItemRentValidator {
  private readonly orderItemRentPeriodValidator = new OrderItemRentPeriodValidator();

  public async validate(branch: Branch, orderItem: OrderItem, item: Item): Promise<boolean> {
    try {
      this.validateOrderItemInfoFields(orderItem);
      await this.orderItemRentPeriodValidator.validate(
        orderItem,
        // @ts-expect-error fixme: auto ignored
        branch.paymentInfo,
        item.price,
      );
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
    if (isNullish(orderItem.info)) {
      throw new BlError('orderItem.info is not set when orderItem.type is "rent"');
    }
    return true;
  }
}
