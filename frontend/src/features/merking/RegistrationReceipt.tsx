import { CloseButton, Group, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconCircleCheck } from "@tabler/icons-react";

import { blidCountLabel } from "@/features/merking/registrationRows";
import type { BatchReceipt } from "@/features/merking/registrationRows";

/** What the last confirmation did. Sits where the list was, until the next scan replaces it. */
export default function RegistrationReceipt({
  receipt,
  onDismiss,
}: {
  receipt: BatchReceipt;
  onDismiss: () => void;
}) {
  return (
    <Group
      justify="space-between"
      align="flex-start"
      wrap="nowrap"
      gap="xs"
      p="sm"
      style={{
        borderRadius: "var(--mantine-radius-md)",
        backgroundColor: "var(--mantine-color-green-light)",
      }}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start" miw={0}>
        <ThemeIcon variant="transparent" color="green" size="md">
          <IconCircleCheck aria-hidden />
        </ThemeIcon>
        <Stack gap={2} miw={0}>
          <Text fw={600} lh={1.3}>
            {blidCountLabel(receipt.added)} koblet til «{receipt.title}»
          </Text>
          {receipt.skipped > 0 && (
            <Text size="sm" c="dimmed">
              {blidCountLabel(receipt.skipped)} var allerede koblet til boka.
            </Text>
          )}
        </Stack>
      </Group>
      <CloseButton aria-label="Lukk kvitteringen" onClick={onDismiss} />
    </Group>
  );
}
