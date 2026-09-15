import { useQuery } from "@tanstack/react-query";

import useApiClient from "@/shared/hooks/useApiClient";

export default function useAllMatches(roundId: string | null) {
  const { api } = useApiClient();
  return useQuery(
    api.matchRounds.matches.queryOptions(
      { params: { id: roundId ?? "" } },
      { staleTime: 30_000, enabled: roundId !== null },
    ),
  );
}
