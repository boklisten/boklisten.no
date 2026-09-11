import { Box, Container, Flex, Group, Skeleton, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import LegacyAppLink from "@/features/auth-linker/LegacyAppLink";
import OpenOrderList from "@/features/order-manager/OpenOrderList";
import OrderDetail from "@/features/order-manager/OrderDetail";
import OrderFilters from "@/features/order-manager/OrderFilters";
import {
  ORDER_MANAGER_DESCRIPTION,
  ORDER_MANAGER_TITLE,
} from "@/features/order-manager/orderManagerDescription";
import { openOrderRows } from "@/features/order-manager/openOrderRows";
import {
  readOrderManagerSearch,
  toOrderManagerFilter,
  toOrderManagerSearch,
  validateOrderManagerSearch,
} from "@/features/order-manager/orderManagerParams";
import type { OrderManagerSearchParams } from "@/features/order-manager/orderManagerParams";
import { ORDER_MANAGER_POLL_MS } from "@/features/order-manager/useOpenOrders";
import useOrderWedgeScanner from "@/features/order-manager/useOrderWedgeScanner";
import useStandCart from "@/features/stand-cart/useStandCart";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(administrasjon)/admin/ordreoversikt")({
  validateSearch: validateOrderManagerSearch,
  head: () =>
    seo({
      title: `${ORDER_MANAGER_TITLE} | bl-admin`,
    }),
  component: OrderManagerPage,
});

/**
 * The queue on the left, the selected order on the right; on a phone the one replaces the other.
 * Everything that narrows or selects lives in the URL, so a reload keeps the employee's place
 * and the back button closes the order.
 */
function OrderManagerPage() {
  const params = readOrderManagerSearch(Route.useSearch());
  const navigate = Route.useNavigate();
  const { api } = useApiClient();
  const selectedId = params.ordre;

  const detailQuery = useQuery(
    api.orderManager.getOrder.queryOptions(
      { params: { orderId: selectedId ?? "" } },
      { enabled: selectedId !== undefined, refetchInterval: ORDER_MANAGER_POLL_MS },
    ),
  );
  const detail = selectedId === undefined ? undefined : detailQuery.data;
  const customerId = detail?.customerId ?? null;
  const cart = useStandCart(
    customerId,
    selectedId === undefined ? undefined : { orderId: selectedId },
  );
  useOrderWedgeScanner(customerId === null ? null : cart);

  // Each order is packed on its own: what was in the cart for the previous one goes with it. The
  // cart can only be emptied once its customer is known, which is after the order has loaded.
  useEffect(() => {
    if (customerId !== null) {
      cart.clear();
    }
    // Only when the selection or its customer changes; the cart hook itself is new on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, customerId]);

  const update = (next: Partial<OrderManagerSearchParams>) =>
    void navigate({ search: toOrderManagerSearch({ ...params, ...next }) });
  const selectOrder = (ordre: string) => update({ ordre });
  const clearOrder = () => update({ ordre: undefined });
  const refreshDetail = async () => {
    const { data } = await detailQuery.refetch();
    return data !== undefined && data !== null && openOrderRows(data.order).length > 0;
  };

  const filter = toOrderManagerFilter(params);
  const showingDetail = selectedId !== undefined;

  let detailPane;
  if (!showingDetail) {
    detailPane = (
      <InfoAlert>Velg en bestilling i listen for å pakke den eller dele ut bøkene.</InfoAlert>
    );
  } else if (detailQuery.isPending) {
    detailPane = (
      <Stack>
        <Skeleton height={110} radius="md" />
        <Skeleton height={200} radius="md" />
      </Stack>
    );
  } else if (detailQuery.isError || !detail) {
    detailPane = <ErrorAlert>Fant ikke bestillingen. Den kan være slettet.</ErrorAlert>;
  } else {
    detailPane = (
      <OrderDetail detail={detail} cart={cart} onBack={clearOrder} onRefresh={refreshDetail} />
    );
  }

  return (
    <Container size="xl">
      <Stack>
        <Stack gap={4}>
          <Group gap="xs">
            <Title>{ORDER_MANAGER_TITLE}</Title>
            <LegacyAppLink path="order-manager" label="Gå til gammel ordreoversikt" />
          </Group>
          <Text c="dimmed">{ORDER_MANAGER_DESCRIPTION}</Text>
        </Stack>
        {/* On a phone the order takes the screen; the filters wait behind "Tilbake til listen" */}
        <Box display={{ base: showingDetail ? "none" : "block", md: "block" }}>
          <OrderFilters params={params} onChange={update} />
        </Box>
        <Flex direction={{ base: "column", md: "row" }} gap="lg" align="flex-start">
          <Box
            w={{ base: "100%", md: 380 }}
            flex="none"
            display={{ base: showingDetail ? "none" : "block", md: "block" }}
            pos={{ base: "static", md: "sticky" }}
            top="calc(var(--app-shell-header-offset, 0px) + var(--mantine-spacing-md))"
          >
            <OpenOrderList filter={filter} selectedOrderId={selectedId} onSelect={selectOrder} />
          </Box>
          <Box
            flex={1}
            miw={0}
            w="100%"
            display={{ base: showingDetail ? "block" : "none", md: "block" }}
          >
            {detailPane}
          </Box>
        </Flex>
      </Stack>
    </Container>
  );
}
