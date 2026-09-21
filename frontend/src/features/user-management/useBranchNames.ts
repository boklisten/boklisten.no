import { useQuery } from "@tanstack/react-query";

import { api } from "@/shared/utils/apiClient";

export default function useBranchNames() {
  const { data: branches } = useQuery(api.branches.index.queryOptions());
  return new Map((branches ?? []).map((branch) => [branch.id, branch.name]));
}
