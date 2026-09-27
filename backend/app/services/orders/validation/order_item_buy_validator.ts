import Order from "#models/order";
import type OrderItem from "#models/order_item";
import { OrderPayments } from "#services/payments/order_payments";
import { PriceService } from "#services/price_service";
import { BlError } from "#shared/bl-error";
import type { Item } from "#shared/item";

export class OrderItemBuyValidator {
  private readonly priceService: PriceService;

  constructor(priceService?: PriceService) {
    this.priceService = priceService ?? new PriceService({ roundDown: true });
  }

  public async validate(orderItem: OrderItem, item: Item): Promise<boolean> {
    try {
      await this.validateOrderItemPriceTypeBuy(orderItem, item);
    } catch (error) {
      if (error instanceof BlError) {
        throw error;
      }
      throw new BlError(
        `unknown error, could not validate price of orderItems, error: ${
          // @ts-expect-error fixme: auto ignored
          error.message
        }`,
      ).store("error", error);
    }

    return true;
  }

  /**
   * A mismatch here does not fail the order: the legacy check swallowed its errors, and that
   * behaviour is kept.
   */
  private async validateIfMovedFromOrder(
    orderItem: OrderItem,
    itemPrice: number,
  ): Promise<boolean> {
    if (orderItem.movedFromOrderId === null) {
      return true;
    }

    try {
      const order = await Order.getOrFail(orderItem.movedFromOrderId);
      if (!(await OrderPayments.exist(order.id)) && orderItem.amount === 0) {
        throw new BlError('the original order has not been payed, but orderItem.amount is "0"');
      }

      const movedFromOrderItem = this.getOrderItemFromOrder(orderItem.itemId, order);

      const expectedOrderItemAmount =
        this.priceService.round(this.priceService.sanitize(itemPrice)) - movedFromOrderItem.amount;

      if (orderItem.amount !== expectedOrderItemAmount) {
        throw new BlError(
          `orderItem amount is "${orderItem.amount}" but should be "${expectedOrderItemAmount}"`,
        );
      }

      return true;
    } catch {
      return false;
    }
  }

  private getOrderItemFromOrder(itemId: string, order: Order): OrderItem {
    const found = order.orderItems.find((orderItem) => orderItem.itemId === itemId);
    if (!found) {
      throw new BlError("not found in original orderItem");
    }
    return found;
  }

  private async validateOrderItemPriceTypeBuy(orderItem: OrderItem, item: Item): Promise<boolean> {
    if (orderItem.movedFromOrderId !== null) {
      return this.validateIfMovedFromOrder(orderItem, item.price);
    }

    const price = this.priceService.sanitize(item.price);

    const expectedPrice = this.priceService.round(price);

    if (orderItem.amount !== expectedPrice) {
      throw new BlError(
        `orderItem.amount "${orderItem.amount}" is not equal to item.price "${item.price}" = "${expectedPrice}" when type is "buy"`,
      );
    }

    return true;
  }
}
