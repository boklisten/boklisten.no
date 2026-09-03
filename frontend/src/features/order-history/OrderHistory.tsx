import { Skeleton, Stack } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import OrderHistoryList from "@/features/order-history/OrderHistoryList";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";

export default function OrderHistory() {
  const { api } = useApiClient();
  const { data, isPending, isError } = useQuery(api.orderHistory.getMyOrders.queryOptions());

  if (isPending) {
    return (
      <Stack gap="xs">
        <Skeleton h={20} w="40%" radius="sm" />
        {[0, 1, 2, 3].map((index) => (
          <Skeleton h={72} radius="md" key={`skeleton-${index}`} />
        ))}
      </Stack>
    );
  }

  if (isError) {
    return (
      <ErrorAlert title="Klarte ikke laste inn ordrehistorikk">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
    );
  }

  if (data.length === 0) {
    return (
      <InfoAlert title="Du har for øyeblikket ingen ordre">
        Trykk på 'bestill bøker' dersom du ønsker å bestille bøker
      </InfoAlert>
    );
  }

  return <OrderHistoryList entries={data} variant="customer" />;
}
