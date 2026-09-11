import type { CustomerCollectionReceipt } from "@boklisten/backend/shared/bulk-collection/bulk-collection-dtos";
import { CloseButton, Divider, Group, Paper, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { Fragment } from "react";

import CustomerReceiptItem from "@/features/bulk-collection/CustomerReceiptItem";
import bookCountLabel from "@/features/bulk-collection/bookCountLabel";

/**
 * What the last delivery did, per customer: a card of its own inside the Innsamling card, where
 * the list was, so its cross plainly closes just the receipt while the outer cross ends the
 * Innsamling. It gives way to the next list the moment a book is scanned.
 */
export default function CollectionReceipt({
  receipt,
  onDismiss,
}: {
  receipt: CustomerCollectionReceipt[];
  /** Clears the receipt and shows the empty list. */
  onDismiss: () => void;
}) {
  const totalDelivered = receipt.reduce((sum, entry) => sum + entry.deliveredCount, 0);
  // Every book in the batch was collected at the same moment; the backend stamps HH:mm:ss.
  const time = receipt[0]?.collectedBooks[0]?.time.slice(0, 5);
  const customerCount = `${receipt.length} ${receipt.length === 1 ? "kunde" : "kunder"}`;

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
          <Title order={3} size="h5">
            Kvittering
          </Title>
          <CloseButton aria-label="Lukk kvitteringen" onClick={onDismiss} />
        </Group>
        <Group gap="sm" align="center" wrap="nowrap">
          <ThemeIcon variant="light" color="green" size="lg" radius="xl">
            <IconCheck size={20} aria-hidden />
          </ThemeIcon>
          <Stack gap={2} miw={0}>
            <Text fw={600} lh={1.2}>
              {bookCountLabel(totalDelivered)} levert
            </Text>
            <Text size="sm" c="dimmed">
              {time !== undefined && `kl. ${time} · `}
              {customerCount}
            </Text>
          </Stack>
        </Group>
        <Divider />
        {receipt.map((entry, index) => (
          <Fragment key={entry.customerId}>
            {index > 0 && <Divider />}
            <CustomerReceiptItem receipt={entry} />
          </Fragment>
        ))}
        <Divider />
        <Text size="sm" c="dimmed">
          Kvitteringen lukkes automatisk når du skanner neste bok
        </Text>
      </Stack>
    </Paper>
  );
}
