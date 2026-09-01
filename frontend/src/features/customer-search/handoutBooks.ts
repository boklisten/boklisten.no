import { itemsAreEquivalent } from "@boklisten/backend/shared/item-equivalence";
import type { MatchDto } from "@boklisten/backend/shared/match/match-dto";
import type { Order } from "@boklisten/backend/shared/order/order";
import type { OrderItem } from "@boklisten/backend/shared/order/order-item/order-item";

import { forViewer, partyName } from "@/features/matches/forViewer";
import type { ViewerObligation } from "@/features/matches/forViewer";

/** A book the customer exchanges with another student (received from / delivered to a peer). */
export interface PeerBook {
  /** Item id. */
  id: string;
  title: string;
  /** Whether the transfer has already happened. */
  fulfilled: boolean;
  /** Name of the other student in the match. */
  personName: string;
}

function isOpenCustomerOrder(order: Order) {
  return order.byCustomer && !order.handoutByDelivery;
}

function isOpenOrderItem(orderItem: OrderItem) {
  return (
    !orderItem.movedToOrder &&
    !orderItem.handout &&
    (orderItem.type === "rent" || orderItem.type === "partly-payment")
  );
}

export function calculateUnfulfilledOrderItems(orders: Order[]): OrderItem[] {
  return orders
    .filter(isOpenCustomerOrder)
    .flatMap((order) => order.orderItems.filter(isOpenOrderItem));
}

/** The open order behind each unfulfilled item, and whether the customer has paid for it. */
export function buildOpenOrderInfo(
  orders: Order[],
): Map<string, { orderId: string; paid: boolean }> {
  const openOrderInfo = new Map<string, { orderId: string; paid: boolean }>();
  for (const order of orders.filter(isOpenCustomerOrder)) {
    for (const orderItem of order.orderItems.filter(isOpenOrderItem)) {
      openOrderInfo.set(orderItem.item, { orderId: order.id, paid: order.amount !== 0 });
    }
  }
  return openOrderInfo;
}

const toPeerBooks = (obligations: ViewerObligation[]): PeerBook[] =>
  obligations.map((obligation) => ({
    id: obligation.itemId,
    title: obligation.title,
    fulfilled: obligation.fulfilled,
    personName: partyName(obligation.expected),
  }));

export function buildPeerBooks(matches: MatchDto[], customerId: string) {
  const receiveBooks: PeerBook[] = [];
  const giveBooks: PeerBook[] = [];
  for (const match of matches) {
    if (match.isStandMatch) {
      continue;
    }
    const { toDeliver, toReceive } = forViewer(match, customerId);
    receiveBooks.push(...toPeerBooks(toReceive));
    giveBooks.push(...toPeerBooks(toDeliver));
  }
  return { receiveBooks, giveBooks };
}

/**
 * How many ordered books are still waiting to be handed out over the counter. Books the customer
 * receives from a peer are excluded, since those never pass through the stand.
 */
export function countStandBooksToHandOut(
  orders: Order[] | undefined,
  matches: MatchDto[] | undefined,
  customerId: string,
): number {
  if (!orders) {
    return 0;
  }
  const { receiveBooks } = buildPeerBooks(matches ?? [], customerId);
  return calculateUnfulfilledOrderItems(orders).filter(
    (orderItem) => !receiveBooks.some((book) => itemsAreEquivalent(book.id, orderItem.item)),
  ).length;
}
