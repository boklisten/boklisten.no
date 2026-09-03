import { Skeleton } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import OrderHistoryCard from "@/features/order-history/OrderHistoryCard";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";

export default function OrderReceipt({ orderId }: { orderId: string }) {
  const { api } = useApiClient();
  const { data, isLoading, isError } = useQuery(
    api.orderHistory.getMyOrder.queryOptions({ params: { orderId } }),
  );

  if (isLoading) {
    return <Skeleton h={300} />;
  }

  if (isError || !data) {
    return (
      <ErrorAlert title="Klarte ikke laste inn ordrekvittering">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
    );
  }
  return <OrderHistoryCard order={data} variant="customer" standalone defaultExpanded />;
}
