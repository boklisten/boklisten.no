import type { MatchRoundDto } from "@boklisten/backend/shared/match/match-round-dto";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/shared/utils/apiClient";

export type Round = MatchRoundDto;

export function isPlanned(round: Round): boolean {
  return round.generatedAt === null;
}

export function useRounds() {
  return useQuery(api.matchRounds.index.queryOptions({}, { staleTime: 60_000 }));
}

export function useRefreshRounds() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: api.matchRounds.index.queryKey() });
    void queryClient.invalidateQueries({ queryKey: api.matchRounds.planMetrics.queryKey() });
  };
}
