import type { OrderManagerRow } from "@boklisten/backend/shared/order_manager";
import { Badge, Group, Stack, Text, UnstyledButton } from "@mantine/core";
import { IconTruck } from "@tabler/icons-react";

import { describeOrderTime } from "@/features/order-manager/orderTime";

function countBooks(count: number): string {
  return count === 1 ? "1 bok" : `${count} bøker`;
}

/**
 * One order in the queue: who, where, when, and what is still owed. The selected one carries a
 * rule down its left edge, so the eye finds it again after a scroll; the badges are the only
 * colour in the list, for the two things that change how the order is handled.
 */
export default function OpenOrderRow({
  row,
  selected,
  onSelect,
}: {
  row: OrderManagerRow;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <UnstyledButton
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      w="100%"
      miw={0}
      px="md"
      py="sm"
      style={{
        borderLeft: `4px solid ${selected ? "var(--mantine-color-brand-filled)" : "transparent"}`,
        backgroundColor: selected ? "var(--mantine-color-brand-light)" : undefined,
      }}
    >
      <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
        <Stack gap={4} miw={0} flex={1}>
          <Text fw={600} truncate>
            {row.customer.name}
          </Text>
          <Text size="sm" c="dimmed" truncate>
            {row.branch.name ?? "Ukjent filial"}
          </Text>
          <Text size="sm" truncate visibleFrom="md">
            {row.openItems.map((item) => item.title).join(", ")}
          </Text>
          <Group gap={4}>
            <Badge variant="light" color="gray" tt="none" size="sm">
              {countBooks(row.openItems.length)}
            </Badge>
            {row.bring && (
              <Badge
                variant="light"
                color="blue"
                tt="none"
                size="sm"
                leftSection={<IconTruck size={12} aria-hidden />}
              >
                I posten
              </Badge>
            )}
            {row.unpaid && (
              <Badge variant="light" color="red" tt="none" size="sm">
                Ikke betalt
              </Badge>
            )}
          </Group>
        </Stack>
        <Text size="xs" c="dimmed" flex="none" style={{ whiteSpace: "nowrap" }}>
          {describeOrderTime(row.creationTime)}
        </Text>
      </Group>
    </UnstyledButton>
  );
}
