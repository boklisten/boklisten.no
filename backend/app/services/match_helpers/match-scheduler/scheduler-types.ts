import type { DateTime } from "luxon";

import type {
  CandidateStandMatch,
  CandidateUserMatch,
} from "#services/match_helpers/match-finder/match-types";

export interface ScheduleInput {
  userMatches: CandidateUserMatch[];
  standMatches: CandidateStandMatch[];
  /** customerId → branchMembership; used only for the class-cohort tiebreak. */
  memberships: Map<string, string>;
  /** Ten-minute ticks of the user-meeting window, ascending. */
  userSlots: DateTime[];
  /** Ten-minute ticks of the stand's opening window, ascending. */
  standSlots: DateTime[];
  /** User-meeting location labels; at least one. No capacities — spread is a soft goal. */
  locations: string[];
}

export interface UserMatchAssignment {
  time: DateTime;
  location: string;
}

export interface ScheduleResult {
  /** Index-aligned with the input userMatches. */
  userMatchAssignments: UserMatchAssignment[];
  /** Index-aligned with the input standMatches. */
  standMatchTimes: DateTime[];
}
