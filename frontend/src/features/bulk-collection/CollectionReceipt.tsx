import type { CustomerCollectionReceipt } from "@boklisten/backend/shared/bulk-collection/bulk-collection-dtos";
import { Accordion, Button, Stack, Text, Title } from "@mantine/core";
import { IconObjectScan } from "@tabler/icons-react";

import CustomerReceiptItem from "@/features/bulk-collection/CustomerReceiptItem";

export default function CollectionReceipt({
  receipt,
  onScanMore,
}: {
  receipt: CustomerCollectionReceipt[];
  onScanMore: () => void;
}) {
  const totalDelivered = receipt.reduce((sum, entry) => sum + entry.deliveredCount, 0);

  return (
    <Stack>
      <Title order={2}>Kvittering</Title>
      <Text>Totalt antall leverte bøker: {totalDelivered}</Text>

      <Button leftSection={<IconObjectScan />} onClick={onScanMore}>
        Skann flere
      </Button>

      <Accordion variant="separated">
        {receipt.map((entry) => (
          <CustomerReceiptItem key={entry.customerId} receipt={entry} />
        ))}
      </Accordion>
    </Stack>
  );
}
