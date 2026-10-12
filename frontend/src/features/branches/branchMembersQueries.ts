import type { QueryClient, QueryKey } from "@tanstack/react-query";

import { api } from "@/shared/utils/apiClient";

/**
 * Everything on a node that is counted or listed by membership: the member list, the customer
 * metrics and duplicate finder, and the signature status and gallery. A membership change
 * anywhere (moving or removing members, uploading a class list, merging accounts) refreshes
 * them all, on every node and page, so the tabs never disagree with each other.
 */
export function branchMembershipQueryKeys(): QueryKey[] {
  return [
    api.branchMembers.index.pathKey(),
    api.users.metrics.pathKey(),
    api.users.duplicates.pathKey(),
    api.branchSignatureStatus.show.pathKey(),
    api.signatures.gallery.pathKey(),
  ];
}

export function invalidateBranchMembership(queryClient: QueryClient): Promise<void[]> {
  return Promise.all(
    branchMembershipQueryKeys().map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}
