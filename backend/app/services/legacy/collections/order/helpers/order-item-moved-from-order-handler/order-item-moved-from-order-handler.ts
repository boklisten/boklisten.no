import { isNullish } from "#services/legacy/typescript-helpers";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { itemsAreEquivalent } from "#shared/item-equivalence";
import type { Order } from "#shared/order/order";

interface OrderItemToUpdate {
  itemId: string;
  originalOrderId: string;
  newOrderId: string;
}

export class OrderItemMovedFromOrderHandler {
  public async updateOrderItems(order: Order): Promise<boolean> {
    const orderItemsToUpdate: OrderItemToUpdate[] = order.orderItems
      .filter((orderItem) => orderItem.movedFromOrder)
      .map((orderItem) => {
        if (isNullish(orderItem.movedFromOrder)) {
          throw new BlError("Not movedFromOrder").code(200);
        }
        return {
          itemId: orderItem.item,
          originalOrderId: orderItem.movedFromOrder,
          newOrderId: order.id,
        };
      });

    return await this.addMovedToOrderOnOrderItems(orderItemsToUpdate);
  }

  private async addMovedToOrderOnOrderItems(
    orderItemsToUpdate: OrderItemToUpdate[],
  ): Promise<boolean> {
    for (const orderItemToUpdate of orderItemsToUpdate) {
      await this.updateOrderItem(orderItemToUpdate);
    }
    return true;
  }

  private async updateOrderItem(orderItemToUpdate: OrderItemToUpdate): Promise<boolean> {
    const originalOrder = await StorageService.Orders.get(orderItemToUpdate.originalOrderId);

    // An order for one edition may have been fulfilled with an equivalent edition; the exact item
    // is preferred, and only when the ordered id itself is absent is a single still-open
    // equivalent closed instead.
    const exactMatches = originalOrder.orderItems.filter(
      (orderItem) => orderItem.item === orderItemToUpdate.itemId,
    );
    const openEquivalent = originalOrder.orderItems.find(
      (orderItem) =>
        !orderItem.movedToOrder && itemsAreEquivalent(orderItem.item, orderItemToUpdate.itemId),
    );
    const matches = exactMatches.length > 0 ? exactMatches : openEquivalent ? [openEquivalent] : [];

    for (const orderItem of matches) {
      if (!orderItem.movedToOrder) {
        orderItem.movedToOrder = orderItemToUpdate.newOrderId;
      } else if (orderItem.movedToOrder !== orderItemToUpdate.newOrderId) {
        throw new BlError(`orderItem has "movedToOrder" already set`);
      }
    }

    await StorageService.Orders.update(orderItemToUpdate.originalOrderId, {
      orderItems: originalOrder.orderItems,
    });
    return true;
  }
}
