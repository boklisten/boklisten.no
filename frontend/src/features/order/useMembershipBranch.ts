import type { PublicBranchNode, PublicBranchTree } from "@boklisten/backend/shared/branch";
import { useQuery } from "@tanstack/react-query";

import { nodeById } from "@/features/order/orderTree";
import useAuth from "@/shared/hooks/useAuth";
import { apiClient } from "@/shared/utils/apiClient";

/**
 * Where a logged-in member's own school sits in the order tree: the membership itself when it is
 * a step, otherwise the nearest ancestor that is (a class belongs under the year group that holds
 * the books). Walks up through the API one parent at a time; nearly always one request.
 */
export default function useMembershipBranch(tree: PublicBranchTree): PublicBranchNode | null {
  const { user } = useAuth();
  const membershipId = user?.branchMembershipId ?? null;
  const { data } = useQuery({
    queryKey: ["order", "membership-branch", membershipId],
    queryFn: async () => {
      let id = membershipId;
      for (let depth = 0; id !== null && depth < 10; depth++) {
        const node = nodeById(tree, id);
        if (node) {
          return node;
        }
        const branch = await apiClient.api.branches.show({ params: { branchId: id } });
        id = branch?.parentBranchId ?? null;
      }
      return null;
    },
    enabled: membershipId !== null,
    staleTime: 5 * 60_000,
  });
  return data ?? null;
}
