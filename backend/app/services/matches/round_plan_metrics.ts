import type MatchRound from "#models/match_round";
import User from "#models/user";
import { getHeldItems, getWantedItems } from "#services/matches/round_scope";
import type { BookTally, MatchRoundPlanMetrics } from "#shared/match/match-round-dto";

function tally(booksByStudent: Map<string, Set<string>>): BookTally {
  let books = 0;
  for (const items of booksByStudent.values()) {
    books += items.size;
  }
  return { books, students: booksByStudent.size };
}

export async function roundPlanMetrics(round: MatchRound): Promise<MatchRoundPlanMetrics> {
  const { branches, deadline, includeCustomerItemsFromOtherBranches } = round;

  const [members, heldBooks, orderedBooks] = await Promise.all([
    User.countMembersOf(branches),
    getHeldItems(branches, deadline, includeCustomerItemsFromOtherBranches),
    getWantedItems(branches),
  ]);

  return {
    branchMembers: members,
    activeBooks: tally(heldBooks),
    orderedBooks: tally(orderedBooks),
  };
}
