import { Skeleton, Stack } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import OrderHistoryList from "@/features/order-history/OrderHistoryList";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import useApiClient from "@/shared/hooks/useApiClient";

const POLL_INTERVAL_MS = 5000;

export default function CustomerOrderHistoryView({ customerId }: { customerId: string }) {
  const { api } = useApiClient();
  const { data, isPending, isError } = useQuery(
    api.orderHistory.getForCustomer.queryOptions(
      { params: { detailsId: customerId } },
      { refetchInterval: POLL_INTERVAL_MS },
    ),
  );

  if (isPending) {
    return (
      <Stack gap="xs">
        <Skeleton h={20} w="40%" radius="sm" />
        <Skeleton h={72} radius="md" />
        <Skeleton h={72} radius="md" />
      </Stack>
    );
  }

  if (isError) {
    return <ErrorAlert>Klarte ikke laste inn kundens ordrehistorikk.</ErrorAlert>;
  }

  if (data.length === 0) {
    return <InfoAlert>Kunden har ingen ordre.</InfoAlert>;
  }

  return <OrderHistoryList entries={data} variant="admin" />;
}
