/**
 * The `HH:MM` ten-minute tick every meeting and stand time is written in. One pattern shared by
 * the backend validator and the plan form, so the two sides cannot drift apart about what a valid
 * time looks like.
 */
export const SLOT_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]0$/;

/** The dates, times, places and book selection a round is generated from. */
export interface MatchRoundPlan {
  standLocation: string;
  /** Mongo branch ids the round draws books from. */
  branches: string[];
  /** `YYYY-MM-DD`. The date the round's books are due. */
  deadline: string;
  /** `YYYY-MM-DD`. Every meeting and stand visit happens on this day. */
  meetingDate: string;
  /** `HH:MM`, on a ten-minute tick. */
  userMeetingFrom: string;
  userMeetingTo: string;
  standFrom: string;
  standTo: string;
  includeCustomerItemsFromOtherBranches: boolean;
  /** Where students meet each other, in the order an admin listed them. */
  userMatchLocations: string[];
  /** Mongo userDetail ids the match finder skips entirely: no matches, books go via the stand. */
  excludedCustomerIds: string[];
}

/**
 * A round as the admin UI sees it.
 *
 * `generatedAt` is what separates a planned round from a generated one, and so the field the UI
 * branches on. The counts are cross-record context a round does not know about itself; they are
 * counted for every round at once and passed in.
 */
export interface MatchRoundDto extends MatchRoundPlan {
  id: string;
  name: string;
  status: string;
  /** ISO timestamp, or null while the round is still only planned. */
  generatedAt: string | null;
  matchCount: number;
  /** Handovers that have already discharged one of this round's obligations. */
  handoverCount: number;
  /** User-match obligations still locked to their handover; 0 once every handover is open. */
  lockedCount: number;
}

export interface BookTally {
  books: number;
  students: number;
}

export interface MatchRoundPlanMetrics {
  branchMembers: number;
  activeBooks: BookTally;
  orderedBooks: BookTally;
}
