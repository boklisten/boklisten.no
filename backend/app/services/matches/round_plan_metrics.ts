import type MatchRound from "#models/match_round";
import { getHeldItems, getWantedItems, membersOfBranches } from "#services/matches/round_scope";
import { StorageService } from "#services/storage_service";
import type { BookTally, MatchRoundPlanMetrics } from "#shared/match/match-round-dto";

function tally(booksByStudent: Map<string, Set<string>>): BookTally {
  let books = 0;
  for (const items of booksByStudent.values()) books += items.size;
  return { books, students: booksByStudent.size };
}

export async function roundPlanMetrics(round: MatchRound): Promise<MatchRoundPlanMetrics> {
  const { branches, deadline, includeCustomerItemsFromOtherBranches } = round;

  const [members, heldBooks, orderedBooks] = await Promise.all([
    StorageService.UserDetails.aggregate([
      { $match: membersOfBranches(branches) },
      { $count: "students" },
    ]),
    getHeldItems(branches, deadline, includeCustomerItemsFromOtherBranches),
    getWantedItems(branches),
  ]);

  return {
    branchMembers: (members[0] as { students: number } | undefined)?.students ?? 0,
    activeBooks: tally(heldBooks),
    orderedBooks: tally(orderedBooks),
  };
}
