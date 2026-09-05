import { Button, Stack, Text } from "@mantine/core";
import { IconLink } from "@tabler/icons-react";

import StepLabel from "@/features/merking/StepLabel";
import { blidCountLabel, describeBlocker, rowState } from "@/features/merking/registrationRows";
import type { ScannedBlidRow, SelectedBook } from "@/features/merking/registrationRows";

/** Step three: the button says exactly what it writes, or the line under it says what is missing. */
export default function RegistrationConfirm({
  rows,
  book,
  loading,
  onConfirm,
}: {
  rows: ScannedBlidRow[];
  book: SelectedBook | null;
  loading: boolean;
  onConfirm: () => void;
}) {
  const blocker = describeBlocker(rows, book);
  const freeCount = rows.filter((row) => rowState(row, book) === "free").length;
  const label =
    book === null || freeCount === 0
      ? "Koble unike IDer til boka"
      : `Koble ${blidCountLabel(freeCount)} til «${book.title}»`;

  return (
    <Stack gap="sm">
      <StepLabel step={3}>Bekreft</StepLabel>
      <Button
        color="green"
        size="md"
        leftSection={<IconLink size={20} aria-hidden />}
        disabled={blocker !== null}
        loading={loading}
        onClick={onConfirm}
        styles={{ label: { whiteSpace: "normal", lineHeight: 1.3 }, root: { height: "auto" } }}
        py={8}
      >
        {label}
      </Button>
      {blocker !== null && (
        <Text size="sm" c="dimmed">
          {blocker}
        </Text>
      )}
    </Stack>
  );
}
