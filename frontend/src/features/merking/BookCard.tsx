import { CloseButton, Group, Paper, Stack, Text } from "@mantine/core";

import BookCover from "@/features/book-cover/BookCover";
import StepLabel from "@/features/merking/StepLabel";
import type { SelectedBook } from "@/features/merking/registrationRows";
import ScanPrompt from "@/shared/components/scanner/ScanPrompt";

/** The one book of the batch: an instruction until an ISBN is scanned, then its cover and title. */
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
          <ScanPrompt type="isbn" flex={1} justify="center">
            Skann bokas ISBN
          </ScanPrompt>
        ) : (
          <Group gap="md" align="center" wrap="nowrap" flex={1}>
            <BookCover isbn={book.isbn} title={book.title} size="xl" />
            <Stack gap="xs" miw={0}>
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
          </Group>
        )}
      </Stack>
    </Paper>
  );
}
