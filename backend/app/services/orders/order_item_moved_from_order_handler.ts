import { Exception } from "@adonisjs/core/exceptions";

import Order from "#models/order";
import { BlError } from "#shared/bl-error";
import { itemsAreEquivalent } from "#shared/item-equivalence";

export class OrderItemMovedFromOrderHandler {
  /** Marks the lines the order's lines moved from as moved to it. */
  public async updateOrderItems(order: Order): Promise<void> {
    const movedLines = order.orderItems.flatMap(({ itemId, movedFromOrderId }) =>
      movedFromOrderId === null ? [] : [{ itemId, movedFromOrderId }],
    );
    const originalOrders = await Order.byIds(movedLines.map((line) => line.movedFromOrderId));
    for (const { itemId, movedFromOrderId } of movedLines) {
      const originalOrder = originalOrders.get(movedFromOrderId);
      if (!originalOrder) {
        throw new Exception(`Fant ikke ordre ${movedFromOrderId}`, {
          status: 404,
          code: "E_ROW_NOT_FOUND",
        });
      }
      markMoved(originalOrder, itemId, order.id);
    }
    for (const originalOrder of originalOrders.values()) {
      await originalOrder.saveWithItems();
    }
  }
}

/**
 * An order for one edition may have been fulfilled with an equivalent edition; the exact item is
 * preferred, and only when the ordered id itself is absent is a single still-open equivalent
 * closed instead.
 */
function markMoved(originalOrder: Order, itemId: string, newOrderId: string) {
  const exactMatches = originalOrder.orderItems.filter((orderItem) => orderItem.itemId === itemId);
  const openEquivalent = originalOrder.orderItems.find(
    (orderItem) =>
      orderItem.movedToOrderId === null && itemsAreEquivalent(orderItem.itemId, itemId),
  );
  const matches = exactMatches.length > 0 ? exactMatches : openEquivalent ? [openEquivalent] : [];
  for (const orderItem of matches) {
    if (orderItem.movedToOrderId === null) {
      orderItem.movedToOrderId = newOrderId;
    } else if (orderItem.movedToOrderId !== newOrderId) {
      throw new BlError(`orderItem has "movedToOrder" already set`);
    }
  }
}
