import type { OrderItem } from "#shared/order/order-item/order-item";

/** Ordered, not handed out, and not carried on into a later order: a book the stand still owes. */
export function isOpenOrderItem(orderItem: OrderItem): boolean {
  return (
    (orderItem.type === "rent" ||
      orderItem.type === "partly-payment" ||
      orderItem.type === "buy") &&
    !orderItem.handout &&
    !orderItem.delivered &&
    !orderItem.movedToOrder
  );
}
