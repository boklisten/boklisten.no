import type Order from "#models/order";
import type OrderItem from "#models/order_item";
import { isNullish, isNumber } from "#services/typescript_helpers";
import { BlError } from "#shared/bl-error";

export class OrderFieldValidator {
  validate(order: Order): Promise<boolean> {
    try {
      this.validateOrderFields(order);

      for (const orderItem of order.orderItems) {
        this.validateOrderItemFields(orderItem);
      }
    } catch (error) {
      if (error instanceof BlError) {
        return Promise.reject(error);
      }
      return Promise.reject(
        new BlError("unknown error, orderItem could not be validated").store("error", error),
      );
    }

    return Promise.resolve(true);
  }

  private validateOrderFields(order: Order): boolean {
    if (isNullish(order.amount)) {
      throw new BlError("order.amount is undefined");
    }

    if (isNullish(order.orderItems) || order.orderItems.length <= 0) {
      throw new BlError("order.orderItems is empty or undefined");
    }
    return true;
  }

  private validateOrderItemFields(orderItem: OrderItem): boolean {
    if (!orderItem.itemId) {
      throw new BlError("orderItem.item is not defined");
    }

    if (!orderItem.title) {
      throw new BlError("orderItem.title is not defined");
    }

    if (!isNumber(orderItem.amount)) {
      throw new BlError("orderItem.amount is not defined");
    }

    if (!isNumber(orderItem.unitPrice)) {
      throw new BlError("orderItem.unitPrice is not defined");
    }

    if (isNullish(orderItem.type)) {
      throw new BlError("orderItem.type is not defined");
    }

    return true;
  }
}
