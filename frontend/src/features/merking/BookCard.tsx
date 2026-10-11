import { Button, CloseButton, Group, Stack, Text } from "@mantine/core";

import BookCover from "@/features/book-cover/BookCover";
import StepPanel from "@/features/merking/StepPanel";
import type { SelectedBook } from "@/features/merking/registrationRows";
import ScanCodeIcon from "@/shared/components/scanner/ScanCodeIcon";
import ScanPrompt from "@/shared/components/scanner/ScanPrompt";

/** Step one: an instruction until an ISBN is scanned, then the book's cover and title. */
export default function BookCard({
  book,
  onClear,
  onScan,
}: {
  book: SelectedBook | null;
  onClear: () => void;
  /** Opens the camera for an ISBN. */
  onScan: () => void;
}) {
  return (
    <StepPanel
      step={1}
      done={book !== null}
      label="Bok"
      aside={
        book !== null && <CloseButton aria-label={`Fjern «${book.title}»`} onClick={onClear} />
      }
    >
      {book === null ? (
        <Stack align="center" gap="md" flex={1} justify="center" p="md">
          <ScanPrompt type="isbn" py={0}>
            Skann bokas ISBN
          </ScanPrompt>
          <Button leftSection={<ScanCodeIcon accepts={["isbn"]} size={18} />} onClick={onScan}>
            Skann ISBN
          </Button>
        </Stack>
      ) : (
        <Group gap="md" align="center" wrap="nowrap" flex={1} p="md">
          <BookCover isbn={book.isbn} title={book.title} size="xl" />
          <Stack gap="xs" miw={0}>
            <Text fz="lg" fw={600} lh={1.3}>
              {book.title}
            </Text>
            <Text size="sm" c="dimmed">
              ISBN {book.isbn}
            </Text>
            <Button
              variant="subtle"
              color="gray"
              size="compact-sm"
              style={{ alignSelf: "flex-start" }}
              leftSection={<ScanCodeIcon accepts={["isbn"]} size={16} />}
              onClick={onScan}
            >
              Skann en annen ISBN
            </Button>
          </Stack>
        </Group>
      )}
    </StepPanel>
  );
}
