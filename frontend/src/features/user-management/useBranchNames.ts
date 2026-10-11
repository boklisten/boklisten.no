import { useQuery } from "@tanstack/react-query";

import { api } from "@/shared/utils/apiClient";
import { withoutRoot } from "@/shared/utils/branchTree";

/** School names by branch id, for showing a customer's membership; a root member has no school. */
export default function useBranchNames() {
  const { data: branches } = useQuery(api.branches.index.queryOptions());
  return new Map(withoutRoot(branches ?? []).map((branch) => [branch.id, branch.name]));
}
