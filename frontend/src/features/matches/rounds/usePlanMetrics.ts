import { useQuery } from "@tanstack/react-query";

import useApiClient from "@/shared/hooks/useApiClient";

export function usePlanMetrics(roundId: string) {
  const { api } = useApiClient();
  return useQuery(
    api.matchRounds.planMetrics.queryOptions({ params: { id: roundId } }, { staleTime: 60_000 }),
  );
}
