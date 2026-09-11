import { Text } from "@mantine/core";

import bookCountLabel from "@/features/bulk-collection/bookCountLabel";
import asyncConfirmModal, { CONFIRM_OVER_SCANNER_Z_INDEX } from "@/shared/utils/asyncConfirmModal";

/**
 * A book is about to go into another customer's cart, or into the Innsamling, while a cart still
 * has unpaid lines. Kasse holds one list at a time, so the waiting cart would be thrown away.
 */
export default function confirmDropCart({
  customerName,
  lineCount,
  destination,
}: {
  customerName: string | null;
  lineCount: number;
  /** Where the book is going, which is what the cart gives way to. */
  destination: "cart" | "batch";
}): Promise<boolean> {
  return asyncConfirmModal({
    title:
      customerName === null
        ? "Du har bøker i en handlekurv som ikke er bekreftet"
        : `Du har bøker i handlekurven til ${customerName} som ikke er bekreftet`,
    children: (
      <Text size="sm">
        Legger du denne boka i {destination === "batch" ? "innsamlingen" : "handlekurven"},
        forkastes handlekurven med {bookCountLabel(lineCount)}.
      </Text>
    ),
    confirmLabel: "Forkast handlekurven",
    confirmColor: "red",
    zIndex: CONFIRM_OVER_SCANNER_Z_INDEX,
  });
}

/** The start screen is about to open, which empties the cart, while it still has unpaid lines. */
export function confirmDiscardCart(
  customerName: string | null,
  lineCount: number,
): Promise<boolean> {
  return asyncConfirmModal({
    title: "Forkast handlekurven?",
    children: (
      <Text size="sm">
        Handlekurven{customerName === null ? "" : ` til ${customerName}`} har{" "}
        {bookCountLabel(lineCount)} som ikke er bekreftet. Forkast dem?
      </Text>
    ),
    confirmLabel: "Forkast handlekurven",
    confirmColor: "red",
  });
}
