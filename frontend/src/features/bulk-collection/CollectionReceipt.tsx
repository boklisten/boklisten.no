import type { CustomerCollectionReceipt } from "@boklisten/backend/shared/bulk-collection/bulk-collection-dtos";
import { CloseButton, Divider, Group, Paper, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconPackageImport } from "@tabler/icons-react";
import { Fragment } from "react";

import CustomerReceiptItem from "@/features/bulk-collection/CustomerReceiptItem";
import bookCountLabel from "@/features/bulk-collection/bookCountLabel";

/**
 * What one delivery did, per customer. Presented like a selected customer or book: a card with a
 * close button, with the scan controls still above it so the next batch is one scan away.
 */
export default function CollectionReceipt({
  receipt,
  onDismiss,
}: {
  receipt: CustomerCollectionReceipt[];
  onDismiss: () => void;
}) {
  const totalDelivered = receipt.reduce((sum, entry) => sum + entry.deliveredCount, 0);
  // Every book in the batch was collected at the same moment; the backend stamps HH:mm:ss.
  const time = receipt[0]?.collectedBooks[0]?.time.slice(0, 5);
  const customerCount = `${receipt.length} ${receipt.length === 1 ? "kunde" : "kunder"}`;

  return (
    <Stack gap={6}>
      <Text fz="sm" fw={500} c="dimmed">
        Kvittering
      </Text>
      <Paper withBorder radius="md" p="md">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
            <Group gap="sm" align="center" wrap="nowrap" miw={0}>
              <ThemeIcon variant="light" color="green" size="lg" radius="xl">
                <IconPackageImport size={20} aria-hidden />
              </ThemeIcon>
              <Stack gap={2} miw={0}>
                <Title order={2} size="h4" lh={1.2}>
                  {bookCountLabel(totalDelivered)} levert
                </Title>
                <Text size="sm" c="dimmed">
                  {time !== undefined && `kl. ${time} · `}
                  {customerCount}
                </Text>
              </Stack>
            </Group>
            <CloseButton aria-label="Lukk kvitteringen" onClick={onDismiss} />
          </Group>
          <Divider />
          {receipt.map((entry, index) => (
            <Fragment key={entry.customerId}>
              {index > 0 && <Divider />}
              <CustomerReceiptItem receipt={entry} />
            </Fragment>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}
