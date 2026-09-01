import { PriceService } from "#services/legacy/price.service";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { Item } from "#shared/item";
import type { Order } from "#shared/order/order";
import type { OrderItem } from "#shared/order/order-item/order-item";

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
        return Promise.reject(error);
      }
      return Promise.reject(
        new BlError(
          `unknown error, could not validate price of orderItems, error: ${
            // @ts-expect-error fixme: auto ignored
            error.message
          }`,
        ).store("error", error),
      );
    }

    return true;
  }

  private async validateIfMovedFromOrder(
    orderItem: OrderItem,
    itemPrice: number,
  ): Promise<boolean> {
    if (!orderItem.movedFromOrder) {
      return true;
    }

    await StorageService.Orders.get(orderItem.movedFromOrder)
      .then((order: Order) => {
        if ((!order.payments || order.payments.length <= 0) && orderItem.amount === 0) {
          throw new BlError('the original order has not been payed, but orderItem.amount is "0"');
        }

        const movedFromOrderItem = this.getOrderItemFromOrder(orderItem.item, order);

        const expectedOrderItemAmount =
          this.priceService.round(this.priceService.sanitize(itemPrice)) -
          movedFromOrderItem.amount;

        if (orderItem.amount !== expectedOrderItemAmount) {
          throw new BlError(
            `orderItem amount is "${orderItem.amount}" but should be "${expectedOrderItemAmount}"`,
          );
        }

        return true;
      })
      .catch(() => false);

    // @ts-expect-error fixme: auto ignored
    return undefined;
  }

  private getOrderItemFromOrder(itemId: string, order: Order): OrderItem {
    for (const orderItem of order.orderItems) {
      if (orderItem.item.toString() === itemId.toString()) {
        return orderItem;
      }
    }

    throw new BlError("not found in original orderItem");
  }

  private async validateOrderItemPriceTypeBuy(orderItem: OrderItem, item: Item): Promise<boolean> {
    if (orderItem.movedFromOrder !== undefined && orderItem.movedFromOrder !== null) {
      return await this.validateIfMovedFromOrder(orderItem, item.price);
    }

    const price = this.priceService.sanitize(item.price);

    const expectedPrice = this.priceService.round(price);

    if (orderItem.amount != expectedPrice) {
      throw new BlError(
        `orderItem.amount "${orderItem.amount}" is not equal to item.price "${item.price}" = "${expectedPrice}" when type is "buy"`,
      );
    }

    return true;
  }
}
