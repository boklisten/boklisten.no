import {
  Button,
  CloseButton,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import CollectionReceipt from "@/features/bulk-collection/CollectionReceipt";
import ScannedBooksList from "@/features/bulk-collection/ScannedBooksList";
import type { CollectionSession } from "@/features/bulk-collection/useCollectionSession";
import bookCountLabel from "@/features/bulk-collection/bookCountLabel";
import { InnsamlingIcon } from "@/features/bulk-collection/innsamlingIcon";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import ScanPrompt from "@/shared/components/scanner/ScanPrompt";

/**
 * Innsamling, presented like a selected customer or book: one card with a close cross. The header
 * is the same in every state, so the card reads as the place books are collected, not as a list
 * that turns into a receipt. Below it: the books scanned so far and the delivery button, or the
 * receipt of the last delivery until the next book is scanned. Scanning itself is the Kasse page's
 * job, and so is the cross: it ends the Innsamling, asking first when undelivered books are in
 * the list.
 */
export default function CollectionView({
  session,
  onClose,
}: {
  session: CollectionSession;
  /** The cross: back to the start screen, which empties the list. */
  onClose: () => void;
}) {
  const { scannedBooks, overdueBooks, receipt } = session;

  return (
    // Named like the hero's Innsamling entry, so opening the view grows the button into this card
    <Stack gap={6} style={{ viewTransitionName: "kasse-innsamling" }}>
      <Text fz="sm" fw={500} c="dimmed">
        Innsamling
      </Text>
      <Paper withBorder radius="md" p="md">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
            <Group gap="sm" align="center" wrap="nowrap" miw={0}>
              <ThemeIcon variant="light" size="lg" radius="xl">
                <InnsamlingIcon size={20} aria-hidden />
              </ThemeIcon>
              <Stack gap={2} miw={0}>
                <Title order={2} size="h4" lh={1.2}>
                  Bøker som skal leveres
                </Title>
                <Text size="sm" c="dimmed">
                  {scannedBooks.length === 0
                    ? "Ingen bøker skannet enda"
                    : bookCountLabel(scannedBooks.length)}
                </Text>
              </Stack>
            </Group>
            <CloseButton aria-label="Avslutt innsamlingen" onClick={onClose} />
          </Group>

          {receipt !== null && (
            <>
              <Divider />
              <CollectionReceipt receipt={receipt} onDismiss={session.scanMore} />
            </>
          )}

          {receipt === null && scannedBooks.length === 0 && (
            <>
              <Divider />
              {/* First-timers see what to hunt for, where the list will be — the same prompt as Merking's sticker step */}
              <ScanPrompt type="blid">Skann unik ID på hver bok</ScanPrompt>
            </>
          )}

          {receipt === null && scannedBooks.length > 0 && (
            <>
              <Divider />
              <ScannedBooksList books={scannedBooks} onRemove={session.removeBook} />
              {overdueBooks.length > 0 && (
                <WarningAlert title="Sjekk bøkene før levering">
                  <Text>{bookCountLabel(overdueBooks.length)} har utløpt frist.</Text>
                </WarningAlert>
              )}
              <Button
                color="green"
                leftSection={<InnsamlingIcon size={20} aria-hidden />}
                loading={session.isDelivering}
                onClick={session.deliver}
              >
                Lever {bookCountLabel(scannedBooks.length)}
              </Button>
            </>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
