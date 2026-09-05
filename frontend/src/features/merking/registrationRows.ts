import type { LinkedBook } from "@boklisten/backend/shared/blid_registration";

export interface SelectedBook {
  id: string;
  title: string;
  isbn: string;
}

export type BlidCheck =
  | { status: "checking" }
  | { status: "checked"; linkedTo: LinkedBook | null }
  | { status: "failed" };

/** One scanned sticker, newest first in the list. */
export interface ScannedBlidRow {
  blid: string;
  check: BlidCheck;
}

/** What the last confirmation did. */
export interface BatchReceipt {
  title: string;
  added: number;
  skipped: number;
}

/** What the row means for the batch, given the book currently selected. */
export type RowState =
  | "checking"
  | "failed"
  | "free"
  /** Linked to a book while no book is selected yet, so it cannot be judged. */
  | "linked"
  | "linked-here"
  | "linked-elsewhere";

export function rowState(row: ScannedBlidRow, book: SelectedBook | null): RowState {
  if (row.check.status !== "checked") {
    return row.check.status;
  }
  if (row.check.linkedTo === null) {
    return "free";
  }
  if (book === null) {
    return "linked";
  }
  return row.check.linkedTo.itemId === book.id ? "linked-here" : "linked-elsewhere";
}

export function blidCountLabel(count: number): string {
  return count === 1 ? "1 unik ID" : `${count} unike IDer`;
}

/** Why the batch cannot be confirmed yet, or null when it can. */
export function describeBlocker(rows: ScannedBlidRow[], book: SelectedBook | null): string | null {
  if (book === null) {
    return "Skann bokas ISBN.";
  }
  if (rows.length === 0) {
    return "Skann unik ID på hver bok.";
  }
  const states = new Set(rows.map((row) => rowState(row, book)));
  if (states.has("checking")) {
    return "Sjekker unike IDer …";
  }
  if (states.has("linked-elsewhere")) {
    return "Fjern unike IDer som er koblet til en annen bok.";
  }
  if (states.has("failed")) {
    return "Fjern unike IDer som ikke kunne sjekkes, og skann dem på nytt.";
  }
  if (!states.has("free")) {
    return "Alle unike IDer i listen er allerede koblet til denne boka.";
  }
  return null;
}
