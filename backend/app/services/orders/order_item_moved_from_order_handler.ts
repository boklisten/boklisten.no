import Order from "#models/order";
import { BlError } from "#shared/bl-error";
import { itemsAreEquivalent } from "#shared/item-equivalence";

interface OrderItemToUpdate {
  itemId: string;
  originalOrderId: string;
  newOrderId: string;
}

export class OrderItemMovedFromOrderHandler {
  public async updateOrderItems(order: Order): Promise<boolean> {
    const orderItemsToUpdate: OrderItemToUpdate[] = order.orderItems.flatMap((orderItem) =>
      orderItem.movedFromOrderId === null
        ? []
        : [
            {
              itemId: orderItem.itemId,
              originalOrderId: orderItem.movedFromOrderId,
              newOrderId: order.id,
            },
          ],
    );

    return this.addMovedToOrderOnOrderItems(orderItemsToUpdate);
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
    const originalOrder = await Order.getOrFail(orderItemToUpdate.originalOrderId);

    // An order for one edition may have been fulfilled with an equivalent edition; the exact item
    // is preferred, and only when the ordered id itself is absent is a single still-open
    // equivalent closed instead.
    const exactMatches = originalOrder.orderItems.filter(
      (orderItem) => orderItem.itemId === orderItemToUpdate.itemId,
    );
    const openEquivalent = originalOrder.orderItems.find(
      (orderItem) =>
        orderItem.movedToOrderId === null &&
        itemsAreEquivalent(orderItem.itemId, orderItemToUpdate.itemId),
    );
    const matches = exactMatches.length > 0 ? exactMatches : openEquivalent ? [openEquivalent] : [];

    for (const orderItem of matches) {
      if (orderItem.movedToOrderId === null) {
        orderItem.movedToOrderId = orderItemToUpdate.newOrderId;
      } else if (orderItem.movedToOrderId !== orderItemToUpdate.newOrderId) {
        throw new BlError(`orderItem has "movedToOrder" already set`);
      }
    }

    await originalOrder.saveWithItems();
    return true;
  }
}
