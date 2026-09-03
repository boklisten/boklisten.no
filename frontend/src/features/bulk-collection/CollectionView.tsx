import { Button, InputLabel, Stack, Text } from "@mantine/core";
import { IconPackageImport } from "@tabler/icons-react";

import CollectionReceipt from "@/features/bulk-collection/CollectionReceipt";
import ScannedBooksList from "@/features/bulk-collection/ScannedBooksList";
import type { CollectionSession } from "@/features/bulk-collection/useCollectionSession";
import bookCountLabel from "@/features/bulk-collection/bookCountLabel";
import WarningAlert from "@/shared/components/alerts/WarningAlert";

/**
 * Innsamling: the books scanned so far, delivered in one go, then the receipt. Scanning itself is
 * the Kasse page's job, so this only shows the state of the batch.
 */
export default function CollectionView({ session }: { session: CollectionSession }) {
  const { scannedBooks, overdueBooks, receipt } = session;

  if (receipt) {
    return <CollectionReceipt receipt={receipt} onDismiss={session.scanMore} />;
  }
  if (scannedBooks.length === 0) {
    return null;
  }

  return (
    <Stack>
      <Stack>
        <InputLabel>Bøker som skal leveres</InputLabel>
        <ScannedBooksList books={scannedBooks} onRemove={session.removeBook} />
      </Stack>

      {overdueBooks.length > 0 && (
        <WarningAlert title="Sjekk bøkene før levering">
          <Text>{bookCountLabel(overdueBooks.length)} har utløpt frist.</Text>
        </WarningAlert>
      )}

      <Button
        color="green"
        leftSection={<IconPackageImport />}
        loading={session.isDelivering}
        onClick={session.deliver}
      >
        Lever {bookCountLabel(scannedBooks.length)}
      </Button>
    </Stack>
  );
}
