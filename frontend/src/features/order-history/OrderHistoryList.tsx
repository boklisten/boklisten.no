import type { OrderHistoryEntry } from "@boklisten/backend/shared/order/order-history";
import { Box, Group, Stack, Text } from "@mantine/core";
import { useState } from "react";

import OrderHistoryCard from "@/features/order-history/OrderHistoryCard";
import type { OrderHistoryVariant } from "@/features/order-history/OrderHistoryCard";
import {
  formatAmount,
  groupOrdersByDay,
  pluralBooks,
  pluralOrders,
} from "@/features/order-history/orderHistoryGroups";
import type { OrderDayGroup } from "@/features/order-history/orderHistoryGroups";

function daySummary(group: OrderDayGroup): string {
  return [
    group.orders.length > 1 ? pluralOrders(group.orders.length) : null,
    // Every book of the day may have moved on to a later order; "0 bøker" would only mislead.
    group.bookCount > 0 ? pluralBooks(group.bookCount) : null,
    group.total === 0 ? null : formatAmount(group.total),
    // One branch is already on every card; several is the thing worth flagging.
    group.branchNames.length > 1 ? group.branchNames.join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The day is the spine: each date is written once, and its orders hang off a rule beneath it.
 * Cards start collapsed; a moved-item link opens and scrolls to the order the book went to.
 */
export default function OrderHistoryList({
  entries,
  variant,
}: {
  entries: OrderHistoryEntry[];
  variant: OrderHistoryVariant;
}) {
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());
  const groups = groupOrdersByDay(entries);
  const listedOrderIds = new Set(entries.map((entry) => entry.id));

  const toggle = (orderId: string) =>
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });

  const reveal = (orderId: string) => {
    setExpandedIds((previous) => new Set(previous).add(orderId));
    // The card exists already (collapsed), so it can be scrolled to at once.
    document
      .querySelector(`#ordre-${orderId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Stack gap="xl">
      {groups.map((group) => (
        <Box key={group.key}>
          <Group justify="space-between" align="baseline" gap="xs" mb="xs" wrap="wrap">
            <Text fw={700}>{group.label}</Text>
            <Text size="sm" c="dimmed">
              {daySummary(group)}
            </Text>
          </Group>
          <Stack
            gap="xs"
            pl={{ base: 10, sm: 16 }}
            style={{ borderLeft: "3px solid var(--mantine-color-default-border)" }}
          >
            {group.orders.map((order) => (
              <OrderHistoryCard
                key={order.id}
                order={order}
                variant={variant}
                listedOrderIds={listedOrderIds}
                onRevealOrder={reveal}
                expanded={expandedIds.has(order.id)}
                onToggle={() => toggle(order.id)}
              />
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
