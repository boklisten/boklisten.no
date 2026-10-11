import { useQuery } from "@tanstack/react-query";

import { api } from "@/shared/utils/apiClient";
import { rootOf } from "@/shared/utils/branchTree";

/**
 * The id of the root branch ("Alle filialer"), which every viewer gets from the branch list. It
 * is the membership of a customer without a school, so forms that hold a membership need it before
 * they can start. `rootBranchId` is undefined until the branches have loaded; `isError` says the
 * request failed and `retry` sends it again.
 */
export default function useRootBranchId(): {
  rootBranchId: string | undefined;
  isError: boolean;
  retry: () => void;
} {
  const { data, isError, refetch } = useQuery({
    ...api.branches.index.queryOptions(),
    select: (branches) => rootOf(branches)?.id,
  });
  return { rootBranchId: data, isError, retry: () => void refetch() };
}
