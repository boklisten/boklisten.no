import { Text } from "@mantine/core";

import bookCountLabel from "@/features/bulk-collection/bookCountLabel";
import asyncConfirmModal from "@/shared/utils/asyncConfirmModal";

/** The Innsamling is about to end (its cross, or the start screen) with undelivered books. */
export default function confirmDiscardBatch(bookCount: number): Promise<boolean> {
  return asyncConfirmModal({
    title: "Forkast innsamlingen?",
    children: (
      <Text size="sm">
        Innsamlingen har {bookCountLabel(bookCount)} som ikke er levert. Forkast dem?
      </Text>
    ),
    confirmLabel: "Forkast innsamlingen",
    confirmColor: "red",
  });
}
