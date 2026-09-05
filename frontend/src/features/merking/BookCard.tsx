import { CloseButton, Group, Paper, Stack, Text } from "@mantine/core";

import StepLabel from "@/features/merking/StepLabel";
import type { SelectedBook } from "@/features/merking/registrationRows";
import ScanCodeIllustration from "@/shared/components/scanner/ScanCodeIllustration";
import { describeScanCodeLocation } from "@/shared/utils/scanCodes";

/** The one book of the batch: an instruction until an ISBN is scanned, then the title. */
export default function BookCard({
  book,
  onClear,
}: {
  book: SelectedBook | null;
  onClear: () => void;
}) {
  return (
    <Paper withBorder radius="md" p="md" h="100%">
      <Stack gap="md" h="100%">
        <Group justify="space-between" wrap="nowrap">
          <StepLabel step={1} done={book !== null}>
            Bok
          </StepLabel>
          {book !== null && <CloseButton aria-label={`Fjern «${book.title}»`} onClick={onClear} />}
        </Group>
        {book === null ? (
          <Stack align="center" gap="xs" py="md" flex={1} justify="center">
            <ScanCodeIllustration type="isbn" scale={2} />
            <Text ta="center" fw={500} mt="xs">
              Skann bokas ISBN.
            </Text>
            <Text ta="center" size="sm" c="dimmed">
              {describeScanCodeLocation("isbn")}.
            </Text>
          </Stack>
        ) : (
          <Stack gap="xs" flex={1} justify="center">
            <Text fz="lg" fw={600} lh={1.3}>
              {book.title}
            </Text>
            <Text size="sm" c="dimmed">
              ISBN {book.isbn}
            </Text>
            <Text size="sm" c="dimmed">
              Skann en annen ISBN for å bytte bok.
            </Text>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
