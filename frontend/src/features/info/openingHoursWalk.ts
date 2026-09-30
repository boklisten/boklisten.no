import { queryOptions } from "@tanstack/react-query";

import type { BranchWalk } from "@/features/branch-walk/walk";
import { api } from "@/shared/utils/apiClient";

/** The tree follows the hours an admin posts; a customer looking for a stand reads it once. */
export function openingHoursTreeOptions() {
  return queryOptions({
    ...api.branches.indexOpeningHours.queryOptions(),
    staleTime: 5 * 60_000,
  });
}

/** The walk down to a branch with a stand ahead, whose hours are then shown. */
export const OPENING_HOURS_WALK: BranchWalk = {
  key: "opening-hours",
  top: { to: "/info/branch", label: "Åpningstider" },
  step: "/info/branch/$branchId",
  leafLabel: "Se åpningstider",
};
