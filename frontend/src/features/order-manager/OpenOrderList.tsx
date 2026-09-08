import type { OrderManagerFilter } from "@boklisten/backend/shared/order_manager";
import { Box, Button, Divider, Group, Paper, Skeleton, Stack, Text } from "@mantine/core";
import { Fragment } from "react";

import OpenOrderRow from "@/features/order-manager/OpenOrderRow";
import useOpenOrders from "@/features/order-manager/useOpenOrders";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import { norwegianTime } from "@/shared/utils/dayjs";

/**
 * The queue of open orders, newest first. Polls on its own; the count and the time of the last
 * look tell the employee the list is alive without anything moving.
 */
export default function OpenOrderList({
  filter,
  selectedOrderId,
  onSelect,
}: {
  filter: OrderManagerFilter;
  selectedOrderId: string | undefined;
  onSelect: (orderId: string) => void;
}) {
  const orders = useOpenOrders(filter);

  if (orders.isPending) {
    return (
      <Stack gap="xs">
        <Skeleton height={72} radius="md" />
        <Skeleton height={72} radius="md" />
        <Skeleton height={72} radius="md" />
      </Stack>
    );
  }
  if (orders.isError) {
    return <ErrorAlert>Klarte ikke hente bestillingene. Prøv å laste siden på nytt.</ErrorAlert>;
  }
  if (orders.rows.length === 0) {
    return (
      <InfoAlert>
        Ingen åpne bestillinger
        {filter.bringOnly || filter.branchIds?.length ? " med dette filteret" : ""}. Nye
        bestillinger dukker opp her av seg selv.
      </InfoAlert>
    );
  }

  const count = `${orders.rows.length}${orders.hasNextPage ? "+" : ""} bestillinger`;
  const checked = `sist sjekket kl. ${norwegianTime(orders.dataUpdatedAt).format("HH:mm:ss")}`;

  return (
    <Stack gap="xs">
      <Group justify="space-between" px={4}>
        <Text size="sm" fw={500}>
          {count}
        </Text>
        <Text size="xs" c="dimmed">
          {checked}
        </Text>
      </Group>
      <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
        {/* Native scrolling: a scroll area would let the rows grow past the column's width */}
        <Box mah={{ base: "none", md: "calc(100vh - 330px)" }} style={{ overflowY: "auto" }}>
          <Stack gap={0}>
            {orders.rows.map((row, index) => (
              <Fragment key={row.id}>
                {index > 0 && <Divider />}
                <OpenOrderRow
                  row={row}
                  selected={row.id === selectedOrderId}
                  onSelect={() => onSelect(row.id)}
                />
              </Fragment>
            ))}
            {orders.hasNextPage && (
              <>
                <Divider />
                <Button
                  variant="subtle"
                  color="gray"
                  radius={0}
                  loading={orders.isFetchingNextPage}
                  onClick={orders.fetchNextPage}
                >
                  Vis eldre bestillinger
                </Button>
              </>
            )}
          </Stack>
        </Box>
      </Paper>
    </Stack>
  );
}
