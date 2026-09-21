import { useQuery } from "@tanstack/react-query";

import { api } from "@/shared/utils/apiClient";

export default function useAllMatches(roundId: string | null) {
  return useQuery(
    api.matchRounds.matches.queryOptions(
      { params: { id: roundId ?? "" } },
      { staleTime: 30_000, enabled: roundId !== null },
    ),
  );
}
