export interface MatchableUser {
  id: string;
  items: Set<string>;
  wantedItems: Set<string>;
  groupMembership: string;
}

export interface CandidateUserMatch {
  customerA: string;
  customerB: string;
  /** Items that are expected to move from A to B */
  expectedAToBItems: Set<string>;
  /** Items that are expected to move from B to A */
  expectedBToAItems: Set<string>;
}

export interface CandidateStandMatch {
  customer: string;
  expectedHandoffItems: Set<string>;
  expectedPickupItems: Set<string>;
}
