import type {
  CustomerCollectionReceipt,
  ScannedBook,
} from "@boklisten/backend/shared/bulk-collection/bulk-collection-dtos";
import { useSyncExternalStore } from "react";

export interface StoredCollection {
  scannedBooks: ScannedBook[];
  /** What the last delivery did; shown until the next batch starts. */
  receipt: CustomerCollectionReceipt[] | null;
}

const EMPTY_COLLECTION: StoredCollection = { scannedBooks: [], receipt: null };

const STORAGE_KEY = "kasse-innsamling";

/**
 * The Innsamling batch: books scanned but not yet delivered, or the receipt of the last delivery.
 * Belongs to nobody in particular (it spans many customers), so it waits in session storage while
 * the employee looks up a customer or a book, reloads, or visits another admin page. Only an
 * explicit action ends it. Read through a tiny external store so the chip in the scan row, the
 * hero label and the list itself all see the same batch.
 */
let current: StoredCollection | null = null;
const listeners = new Set<() => void>();

function readStored(): StoredCollection {
  if (typeof window === "undefined") {
    return EMPTY_COLLECTION;
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return EMPTY_COLLECTION;
    }
    const stored: unknown = JSON.parse(raw);
    if (typeof stored !== "object" || stored === null) {
      return EMPTY_COLLECTION;
    }
    const { scannedBooks, receipt } = stored as Partial<StoredCollection>;
    return {
      scannedBooks: Array.isArray(scannedBooks) ? scannedBooks : [],
      receipt: Array.isArray(receipt) ? receipt : null,
    };
  } catch {
    return EMPTY_COLLECTION;
  }
}

export function getCollection(): StoredCollection {
  current ??= readStored();
  return current;
}

function setCollection(next: StoredCollection): void {
  current = next;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage is a convenience; the in-memory batch still works for this page load
  }
  for (const listener of listeners) {
    listener();
  }
}

export function updateCollection(
  update: (collection: StoredCollection) => StoredCollection,
): StoredCollection {
  const next = update(getCollection());
  setCollection(next);
  return next;
}

/** Empties the list without delivering; the receipt, if any, stays. */
export function clearScannedBooks(): void {
  updateCollection((collection) => ({ ...collection, scannedBooks: [] }));
}

/** Drops the receipt of the last delivery; the list is untouched. */
export function clearReceipt(): void {
  updateCollection((collection) =>
    collection.receipt === null ? collection : { ...collection, receipt: null },
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCollectionState(): StoredCollection {
  return useSyncExternalStore(subscribe, getCollection, () => EMPTY_COLLECTION);
}
