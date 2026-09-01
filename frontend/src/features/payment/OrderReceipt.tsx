import { Skeleton } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import OrderCard from "@/shared/components/OrderCard";
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
  return (
    <OrderCard
      id={data.id}
      creationTime={data.creationTime}
      orderItems={data.orderItems}
      payments={data.payments}
      branchName={data.branchName}
      defaultExpanded
    />
  );
}
