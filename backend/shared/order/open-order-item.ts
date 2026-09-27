import type { OrderItem } from "#shared/order/order";
import type { OrderItemType } from "#shared/order/order-item/order-item-type";

/** The order item types that promise the customer a physical book. */
export const OPEN_ORDER_ITEM_TYPES: readonly OrderItemType[] = ["rent", "partly-payment", "buy"];

/** The open order item types that lend the book out, and so carry a deadline. */
export const LOAN_ORDER_ITEM_TYPES: readonly OrderItemType[] = ["rent", "partly-payment"];

/**
 * Ordered, not handed out, and not carried on into a later order: a book the stand still owes.
 * Takes an order line, a stored one or one as the order history presents it.
 */
export function isOpenOrderItem(
  orderItem: Pick<OrderItem, "type" | "handout" | "delivered" | "movedToOrderId">,
): boolean {
  return (
    OPEN_ORDER_ITEM_TYPES.includes(orderItem.type) &&
    !orderItem.handout &&
    !orderItem.delivered &&
    orderItem.movedToOrderId === null
  );
}
