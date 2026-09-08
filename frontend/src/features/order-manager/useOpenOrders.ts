import type { OrderManagerFilter } from "@boklisten/backend/shared/order_manager";
import { useInfiniteQuery } from "@tanstack/react-query";

import useApiClient from "@/shared/hooks/useApiClient";

/** New orders arrive while the stand works; the list looks again this often. */
export const ORDER_MANAGER_POLL_MS = 10_000;

/** Every open order matching the filter, newest first, a page at a time, kept fresh by polling. */
export default function useOpenOrders(filter: OrderManagerFilter) {
  const { api } = useApiClient();
  const query = useInfiniteQuery({
    ...api.orderManager.listOpenOrders.infiniteQueryOptions(
      { query: filter },
      {
        pageParamKey: "cursor",
        initialPageParam: "",
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    ),
    refetchInterval: ORDER_MANAGER_POLL_MS,
  });
  return {
    rows: query.data?.pages.flatMap((page) => page.rows) ?? [],
    isPending: query.isPending,
    isError: query.isError,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => void query.fetchNextPage(),
    dataUpdatedAt: query.dataUpdatedAt,
  };
}
