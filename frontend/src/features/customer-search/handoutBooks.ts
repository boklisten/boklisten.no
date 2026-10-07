import { itemsAreEquivalent } from "@boklisten/backend/shared/item-equivalence";
import type { MatchDto } from "@boklisten/backend/shared/match/match-dto";
import { isOpenOrderItem } from "@boklisten/backend/shared/order/open-order-item";
import type { Order, OrderItem } from "@boklisten/backend/shared/order/order";

import { forViewer, partyName } from "@/features/matches/forViewer";
import type { ViewerObligation } from "@/features/matches/forViewer";

/** A book the customer exchanges with another student (received from / delivered to a peer). */
export interface PeerBook {
  /** Item id. */
  id: string;
  title: string;
  /** Whether the transfer has already happened. */
  fulfilled: boolean;
  /** The other student in the match: null when the expected party is the stand. */
  personId: string | null;
  /** Name of the other student in the match. */
  personName: string;
}

/**
 * Any placed order may hold books still to be handed out: the customer's own, and the ones the
 * stand wrote when it moved an order to another branch or period without handing out.
 */
function calculateUnfulfilledOrderItems(orders: Order[]): OrderItem[] {
  return orders
    .filter((order) => order.placed)
    .flatMap((order) => order.orderItems.filter(isOpenOrderItem));
}

interface OpenOrderInfo {
  orderId: string;
  title: string;
  isbn: string | null;
  type: OrderItem["type"];
  /** The order's branch, shared by every book in it. */
  branchId: string;
  /** `YYYY-MM-DD`: the period end the order was placed with; legacy items may lack one. */
  deadline: string | undefined;
}

/** The open order behind each unfulfilled item. */
export function buildOpenOrderInfo(orders: Order[]): Map<string, OpenOrderInfo> {
  const openOrderInfo = new Map<string, OpenOrderInfo>();
  for (const order of orders.filter((placedOrder) => placedOrder.placed)) {
    for (const orderItem of order.orderItems.filter(isOpenOrderItem)) {
      openOrderInfo.set(orderItem.itemId, {
        orderId: order.id,
        title: orderItem.title,
        isbn: orderItem.isbn,
        type: orderItem.type,
        branchId: order.branchId,
        deadline: orderItem.periodTo ?? undefined,
      });
    }
  }
  return openOrderInfo;
}

const toPeerBooks = (obligations: ViewerObligation[]): PeerBook[] =>
  obligations.map((obligation) => ({
    id: obligation.itemId,
    title: obligation.title,
    fulfilled: obligation.fulfilled,
    personId: obligation.expected.kind === "customer" ? obligation.expected.customerId : null,
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
 * Pairs each book with the pending peer obligation for its title, keyed by the book's own key.
 * Matching is edition-tolerant, and each obligation is taken by at most one book, so two copies
 * of a title go to (or come from) their respective students.
 */
function pairWithPeers<Book>(
  books: Book[],
  peerBooks: PeerBook[],
  keyOf: (book: Book) => { key: string; itemId: string },
): Map<string, PeerBook> {
  const pending = peerBooks.filter((book) => !book.fulfilled);
  const peers = new Map<string, PeerBook>();
  for (const book of books) {
    const { key, itemId } = keyOf(book);
    const index = pending.findIndex((peerBook) => itemsAreEquivalent(peerBook.id, itemId));
    const [peerBook] = index === -1 ? [] : pending.splice(index, 1);
    if (peerBook) {
      peers.set(key, peerBook);
    }
  }
  return peers;
}

/** The student each ordered book is to come from, for books that come through an overlevering. */
export function buildReceiveFromPeers<Book>(
  books: Book[],
  matches: MatchDto[],
  customerId: string,
  keyOf: (book: Book) => { key: string; itemId: string },
): Map<string, PeerBook> {
  return pairWithPeers(books, buildPeerBooks(matches, customerId).receiveBooks, keyOf);
}

/** The student each held book is due to be given to, keyed by the book's own id. */
export function buildDeliverToPeers(
  books: { id: string; itemId: string }[],
  matches: MatchDto[],
  customerId: string,
): Map<string, PeerBook> {
  return pairWithPeers(books, buildPeerBooks(matches, customerId).giveBooks, (book) => ({
    key: book.id,
    itemId: book.itemId,
  }));
}

/**
 * How many ordered books are still waiting to be handed out over the counter. Books the customer
 * receives from a peer are excluded, since those should not pass through the stand.
 */
export function countStandBooksToHandOut(
  orders: Order[] | undefined,
  matches: MatchDto[] | undefined,
  customerId: string,
): number {
  if (!orders) {
    return 0;
  }
  const orderItems = calculateUnfulfilledOrderItems(orders);
  const fromPeers = buildReceiveFromPeers(orderItems, matches ?? [], customerId, (orderItem) => ({
    key: String(orderItem.id),
    itemId: orderItem.itemId,
  }));
  return orderItems.length - fromPeers.size;
}
