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
  /** Transient: a half-finished link belongs to the scanner it started in, not to the session. */
  linking: StandCartLinking | null;
}

export const EMPTY_CART: StoredCart = { branchId: null, lines: [], linking: null };

const STORAGE_KEY = "stand-cart";

/**
 * One cart at a time, for the customer on screen: switching customer starts afresh. Kept in
 * session storage so a reload or a detour into Boksøk keeps it, and read through a tiny
 * external store so the row buttons, the drawer and the scanner modal (which lives outside the
 * page's React tree) all see the same cart.
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

/** The previous customer's cart goes with them when another customer comes on screen. */
function forget(): void {
  current = null;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored to forget
  }
}

export function getStandCart(customerId: string): StoredCart {
  current ??= readStored();
  if (current !== null && current.customerId !== customerId) {
    forget();
  }
  return current?.cart ?? EMPTY_CART;
}

export function setStandCart(customerId: string, cart: StoredCart): void {
  current = { customerId, cart };
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ customerId, cart: { ...cart, linking: null } }),
    );
  } catch {
    // Storage is a convenience; the in-memory cart still works for this page load
  }
  for (const listener of listeners) {
    listener();
  }
}

export function updateStandCart(
  customerId: string,
  update: (cart: StoredCart) => StoredCart,
): StoredCart {
  const next = update(getStandCart(customerId));
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
