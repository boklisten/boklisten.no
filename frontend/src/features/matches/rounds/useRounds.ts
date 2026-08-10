import { useQuery } from "@tanstack/react-query";

import useApiClient from "@/shared/hooks/useApiClient";

export interface Round {
  id: string;
  name: string;
  status: string;
}

export function useRounds() {
  const { api } = useApiClient();
  return useQuery(api.matchRounds.index.queryOptions({}, { staleTime: 60_000 }));
}
