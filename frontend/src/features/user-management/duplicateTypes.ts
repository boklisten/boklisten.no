import type { UserPermission } from "@boklisten/backend/shared/user-permission";

export interface DuplicateUserSummary {
  detailsId: string;
  name: string;
  email: string;
  phone: string;
  permission: UserPermission;
  branchMembership: string | null;
  lastActive: string | null;
  activeBooks: number;
  orderedItems: number;
  activeMatches: number;
}

export interface DuplicatePair {
  score: number;
  reasons: string[];
  users: DuplicateUserSummary[];
}

export function duplicatePairKey(pair: DuplicatePair) {
  return pair.users
    .map((user) => user.detailsId)
    .sort()
    .join("|");
}
