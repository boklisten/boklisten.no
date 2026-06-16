import type {
  CustomerCollectionReceipt,
  ScannedBook,
} from "@boklisten/backend/shared/bulk-collection/bulk-collection-dtos";
import { Accordion, Button, Stack, Text, Title } from "@mantine/core";
import { IconObjectScan } from "@tabler/icons-react";

import CustomerReceiptItem from "@/features/bulk-collection/CustomerReceiptItem";
import WarningAlert from "@/shared/components/alerts/WarningAlert";

export default function CollectionReceipt({
  receipt,
  skippedLockedBooks,
  onScanMore,
}: {
  receipt: CustomerCollectionReceipt[];
  skippedLockedBooks: ScannedBook[];
  onScanMore: () => void;
}) {
  const totalDelivered = receipt.reduce((sum, entry) => sum + entry.deliveredCount, 0);

  return (
    <Stack>
      <Title order={2}>Kvittering</Title>
      <Text>Totalt antall leverte bøker: {totalDelivered}</Text>

      {skippedLockedBooks.length > 0 && (
        <WarningAlert title={"Ikke levert – låst til overlevering"}>
          <Stack gap={4}>
            {skippedLockedBooks.map((book) => (
              <Text key={book.blid}>
                {book.title} ({book.customerName})
              </Text>
            ))}
          </Stack>
        </WarningAlert>
      )}

      <Button leftSection={<IconObjectScan />} onClick={onScanMore}>
        Skann flere
      </Button>

      <Accordion variant={"separated"}>
        {receipt.map((entry) => (
          <CustomerReceiptItem key={entry.customerId} receipt={entry} />
        ))}
      </Accordion>
    </Stack>
  );
}
