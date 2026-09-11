import type { StandCartChoice, StandCartLine } from "@boklisten/backend/shared/stand_cart";
import { useSyncExternalStore } from "react";

export interface StoredLine {
  line: StandCartLine;
  choice: StandCartChoice;
  /** Why the line no longer holds after a refresh; the employee removes it. */
  problem: string | null;
}

/** Which scanner started a link; the link step stays with it, since the two look nothing alike. */
export type StandCartLinkSource = "camera" | "wedge";

/** A scanned blid that is linked to no book yet, waiting for its ISBN and the employee's yes. */
export interface StandCartLinking {
  blid: string;
  via: StandCartLinkSource;
  /** The ISBN scanned for it and the title it resolves to, awaiting confirmation. */
  candidate: { isbn: string; title: string } | null;
}

export interface StoredCart {
  /** The branch every handout is priced from and recorded on; set by the first line added. */
  branchId: string | null;
  lines: StoredLine[];
  /** Whose cart it is, so a page can name the customer without a query while the cart waits. */
  customerName: string | null;
  /** Transient: a half-finished link belongs to the scanner it started in, not to the session. */
  linking: StandCartLinking | null;
}

export const EMPTY_CART: StoredCart = {
  branchId: null,
  lines: [],
  customerName: null,
  linking: null,
};

const STORAGE_KEY = "stand-cart";

/**
 * One cart at a time, for one customer, kept until it is paid or given up: it follows the employee
 * through other customers, books and the Innsamling, and a reload keeps it too. Read through a
 * tiny external store so the row buttons, the drawer, the list bar and the scanner all see the
 * same cart. Another customer's reads see an empty cart; their first add asks before replacing it.
 */
let current: { customerId: string; cart: StoredCart } | null = null;
const listeners = new Set<() => void>();

function readStored(): typeof current {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    // Session storage may hold something older than this shape; missing fields fall back
    const stored: unknown = JSON.parse(raw);
    if (typeof stored !== "object" || stored === null || !("customerId" in stored)) {
      return null;
    }
    const { customerId, cart } = stored as { customerId: unknown; cart?: Partial<StoredCart> };
    return typeof customerId === "string"
      ? { customerId, cart: { ...EMPTY_CART, ...cart, linking: null } }
      : null;
  } catch {
    return null;
  }
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Drops the cart: paid, given up, or its customer merged away. */
export function forget(): void {
  current = null;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored to forget
  }
  notify();
}

/** The cart with unpaid lines, whoever it belongs to; null while no cart waits. */
export function peekStandCart(): { customerId: string; cart: StoredCart } | null {
  current ??= readStored();
  return current !== null && current.cart.lines.length > 0 ? current : null;
}

/** This customer's cart; empty while the stored cart belongs to someone else. */
function getStandCart(customerId: string): StoredCart {
  current ??= readStored();
  return current !== null && current.customerId === customerId ? current.cart : EMPTY_CART;
}

function setStandCart(customerId: string, cart: StoredCart): void {
  current = { customerId, cart };
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ customerId, cart: { ...cart, linking: null } }),
    );
  } catch {
    // Storage is a convenience; the in-memory cart still works for this page load
  }
  notify();
}

export function updateStandCart(
  customerId: string,
  update: (cart: StoredCart) => StoredCart,
): StoredCart {
  const before = getStandCart(customerId);
  const next = update(before);
  // A no-op must not replace a waiting cart. Another customer's clear or cancel is one: their view
  // of the cart is the shared EMPTY_CART, which is also what a clear writes back.
  if (next === before) {
    return next;
  }
  setStandCart(customerId, next);
  return next;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStandCartState(customerId: string | null): StoredCart {
  return useSyncExternalStore(
    subscribe,
    () => (customerId === null ? EMPTY_CART : getStandCart(customerId)),
    () => EMPTY_CART,
  );
}

/** The waiting cart as seen from a view that shows no customer, e.g. a book's history. */
export function useWaitingStandCart(): { customerId: string; cart: StoredCart } | null {
  return useSyncExternalStore(subscribe, peekStandCart, () => null);
}
