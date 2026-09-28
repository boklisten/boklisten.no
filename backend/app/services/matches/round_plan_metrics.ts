import type MatchRound from "#models/match_round";
import User from "#models/user";
import { getRoundBooks, resolveRoundScope } from "#services/matches/round_scope";
import type { BooksByCustomer } from "#services/matches/round_scope";
import type { BookTally, MatchRoundPlanMetrics } from "#shared/match/match-round-dto";

function tally(...parts: BooksByCustomer[]): BookTally {
  const students = new Set<string>();
  let books = 0;
  for (const part of parts) {
    for (const [customerId, items] of part) {
      students.add(customerId);
      books += items.size;
    }
  }
  return { books, students: students.size };
}

export async function roundPlanMetrics(round: MatchRound): Promise<MatchRoundPlanMetrics> {
  const scope = await resolveRoundScope(round);
  const [members, { held, wanted }] = await Promise.all([
    User.countMembersOf(scope.branchIds),
    getRoundBooks(round, scope),
  ]);

  return {
    branchMembers: members,
    activeBooks: tally(held.matchable, held.standOnly),
    orderedBooks: tally(wanted.matchable, wanted.standOnly),
    standOnlyBooks: tally(held.standOnly, wanted.standOnly),
  };
}
