import { useQuery } from "@tanstack/react-query";

import useApiClient from "@/shared/hooks/useApiClient";

export default function useAllMatches() {
  const { api } = useApiClient();
  return useQuery(api.matches.getAllMatches.queryOptions({}, { staleTime: 30_000 }));
}
