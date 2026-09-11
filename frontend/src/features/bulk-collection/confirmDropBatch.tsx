import { Text } from "@mantine/core";

import bookCountLabel from "@/features/bulk-collection/bookCountLabel";
import asyncConfirmModal, { CONFIRM_OVER_SCANNER_Z_INDEX } from "@/shared/utils/asyncConfirmModal";

/** A book is about to go into a cart while the Innsamling batch still has undelivered books. */
export default function confirmDropBatch(bookCount: number): Promise<boolean> {
  return asyncConfirmModal({
    title: "Du har bøker i en innsamling som ikke er levert",
    children: (
      <Text size="sm">
        Legger du denne boka i handlekurven, forkastes innsamlingen med {bookCountLabel(bookCount)}.
      </Text>
    ),
    confirmLabel: "Forkast innsamlingen",
    confirmColor: "red",
    zIndex: CONFIRM_OVER_SCANNER_Z_INDEX,
  });
}
