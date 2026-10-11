import { Box, Text } from "@mantine/core";
import type { ReactNode } from "react";

import BlidRows from "@/features/merking/BlidRows";
import StepPanel from "@/features/merking/StepPanel";
import { blidCountLabel } from "@/features/merking/registrationRows";
import type { ScannedBlidRow, SelectedBook } from "@/features/merking/registrationRows";

/** Step two as the page and the camera modal both show it: the count in the band, the rows under. */
export default function ScannedBlidPanel({
  step,
  rows,
  book,
  onRemove,
  footer,
  children,
}: {
  step?: number;
  rows: ScannedBlidRow[];
  book: SelectedBook | null;
  onRemove: (blid: string) => void;
  /** Under the rows. */
  footer?: ReactNode;
  /** The body while there are no rows. */
  children?: ReactNode;
}) {
  const done = rows.length > 0;
  return (
    <StepPanel
      step={step}
      done={done}
      label="Unike IDer"
      aside={
        <Text size="sm" c="dimmed" role="status">
          {blidCountLabel(rows.length)}
        </Text>
      }
    >
      {done ? (
        <>
          <Box px="md" pb={4}>
            <BlidRows rows={rows} book={book} onRemove={onRemove} />
          </Box>
          {footer}
        </>
      ) : (
        children
      )}
    </StepPanel>
  );
}
