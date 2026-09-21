import { useQuery } from "@tanstack/react-query";

import { api } from "@/shared/utils/apiClient";

export function usePlanMetrics(roundId: string) {
  return useQuery(
    api.matchRounds.planMetrics.queryOptions({ params: { id: roundId } }, { staleTime: 60_000 }),
  );
}
