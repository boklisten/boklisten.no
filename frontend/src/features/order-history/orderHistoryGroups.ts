import type { OrderHistoryEntry } from "@boklisten/backend/shared/order/order-history";

import { norwegianTime } from "@/shared/utils/dayjs";

export interface OrderDayGroup {
  /** YYYY-MM-DD in Norwegian time. */
  key: string;
  /** "tirsdag 1. september 2026" */
  label: string;
  orders: OrderHistoryEntry[];
  /** Items still belonging to these orders (moved items are counted on the order they went to). */
  bookCount: number;
  total: number;
  /** Distinct branch names, in first-seen order. */
  branchNames: string[];
}

export function capitalize(text: string): string {
  return text.length > 0 ? text[0]!.toUpperCase() + text.slice(1) : text;
}

function formatDayLabel(isoTime: string): string {
  return capitalize(norwegianTime(isoTime).format("dddd D. MMMM YYYY"));
}

/**
 * Same-day orders form one group. Most customers place several one-book orders in a row at the
 * stand, so the day, not the order, is the natural unit for scanning a history. Entries are
 * expected newest first; groups keep that order.
 */
export function groupOrdersByDay(entries: OrderHistoryEntry[]): OrderDayGroup[] {
  const groups = new Map<string, OrderDayGroup>();
  for (const entry of entries) {
    const key = norwegianTime(entry.creationTime).format("YYYY-MM-DD");
    let group = groups.get(key);
    if (group === undefined) {
      group = {
        key,
        label: formatDayLabel(entry.creationTime),
        orders: [],
        bookCount: 0,
        total: 0,
        branchNames: [],
      };
      groups.set(key, group);
    }
    group.orders.push(entry);
    group.bookCount += entry.items.filter((item) => item.movedToOrderId === null).length;
    group.total += entry.amount;
    if (!group.branchNames.includes(entry.branch.name)) {
      group.branchNames.push(entry.branch.name);
    }
  }
  return [...groups.values()];
}

export function formatAmount(amount: number): string {
  return amount < 0 ? `−${Math.abs(amount)} kr` : `${amount} kr`;
}

export function pluralBooks(count: number): string {
  return count === 1 ? "1 bok" : `${count} bøker`;
}

export function pluralOrders(count: number): string {
  return count === 1 ? "1 ordre" : `${count} ordre`;
}
