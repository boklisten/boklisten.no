import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Group, Text } from "@mantine/core";
import { IconMail, IconPhone } from "@tabler/icons-react";

/**
 * The ways of reaching a customer, phone then e-mail, on one line however narrow the screen: the
 * phone number keeps its width and a long e-mail address is cut with an ellipsis, the whole of it
 * a hover away.
 */
export default function CustomerContactRow({
  customer,
}: {
  customer: Pick<UserDetail, "phone" | "email">;
}) {
  return (
    <Group gap="md" c="dimmed" wrap="nowrap">
      {customer.phone && (
        <Group gap={6} wrap="nowrap" flex="0 0 auto">
          <IconPhone size={16} aria-hidden />
          <Text size="sm">{customer.phone}</Text>
        </Group>
      )}
      {customer.email && (
        <Group gap={6} wrap="nowrap" miw={0}>
          <IconMail size={16} aria-hidden style={{ flexShrink: 0 }} />
          <Text size="sm" truncate title={customer.email}>
            {customer.email}
          </Text>
        </Group>
      )}
    </Group>
  );
}
