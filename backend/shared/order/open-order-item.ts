import type { OrderHistoryItem } from "#shared/order/order-history";
import type { OrderItem } from "#shared/order/order-item/order-item";
import type { OrderItemType } from "#shared/order/order-item/order-item-type";

/** The order item types that promise the customer a physical book. */
export const OPEN_ORDER_ITEM_TYPES: readonly OrderItemType[] = ["rent", "partly-payment", "buy"];

/** Ordered, not handed out, and not carried on into a later order: a book the stand still owes. */
export function isOpenOrderItem(orderItem: OrderItem): boolean {
  return (
    OPEN_ORDER_ITEM_TYPES.includes(orderItem.type) &&
    !orderItem.handout &&
    !orderItem.delivered &&
    !orderItem.movedToOrder
  );
}

/** The same rule on an order as the order history presents it. */
export function isOpenOrderHistoryItem(item: OrderHistoryItem): boolean {
  return (
    OPEN_ORDER_ITEM_TYPES.includes(item.type) &&
    !item.handout &&
    !item.delivered &&
    item.movedToOrderId === null
  );
}
