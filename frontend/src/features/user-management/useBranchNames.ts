import { useQuery } from "@tanstack/react-query";

import useApiClient from "@/shared/hooks/useApiClient";

export default function useBranchNames() {
  const { api } = useApiClient();
  const { data: branches } = useQuery(api.branches.getAll.queryOptions());
  return new Map((branches ?? []).map((branch) => [branch.id, branch.name]));
}
