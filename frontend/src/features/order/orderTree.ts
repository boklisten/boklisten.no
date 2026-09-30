import { queryOptions } from "@tanstack/react-query";

import type { BranchWalk } from "@/features/branch-walk/walk";
import { api } from "@/shared/utils/apiClient";

/** The tree changes when an admin edits branches, not while a customer walks it. */
export function orderTreeOptions() {
  return queryOptions({ ...api.branches.indexPublic.queryOptions(), staleTime: 5 * 60_000 });
}

/** The walk down to a branch's subjects, from which the cart is made. */
export const ORDER_WALK: BranchWalk = {
  key: "order",
  top: { to: "/bestilling", label: "Bestill bøker" },
  step: "/bestilling/$branchId",
  leafLabel: "Velg fag",
};
