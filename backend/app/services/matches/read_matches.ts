import Item from "#models/item";
import type BookHandover from "#models/book_handover";
import type Match from "#models/match";
import MatchRound from "#models/match_round";
import User from "#models/user";
import { MatchRepository } from "#services/matches/match_repository";
import type { MatchDto } from "#shared/match/match-dto";
import { toMatchDtos } from "#transformers/match_transformer";
import type { MatchLookups, MatchPerson } from "#transformers/match_transformer";

async function getPeople(customerIds: string[]): Promise<Map<string, MatchPerson>> {
  const users = await User.byIds(customerIds);
  return new Map(
    [...users.values()].map((user) => [
      user.id,
      { name: user.name, phone: user.phone ?? "", email: user.email },
    ]),
  );
}

/** Inactive items keep their title here too: a book deactivated mid-round is still being handed over. */
async function getTitles(itemIds: string[]): Promise<Map<string, string>> {
  return Item.titlesByIds(itemIds);
}

/**
 * Collects every customer and item the rendered matches refer to, in two Mongo reads.
 *
 * Handover counterparties are included deliberately: when a student receives a book from someone
 * outside their own match, naming that person is the whole point of recording the handover, and
 * they will not appear among the participants.
 */
async function buildLookups(matches: Match[], handovers: BookHandover[]): Promise<MatchLookups> {
  const customerIds = new Set<string>();
  for (const match of matches) {
    for (const participant of match.participants) {
      if (participant.userDetailId !== null) {
        customerIds.add(participant.userDetailId);
      }
    }
  }
  for (const handover of handovers) {
    if (handover.fromUserDetailId !== null) {
      customerIds.add(handover.fromUserDetailId);
    }
    if (handover.toUserDetailId !== null) {
      customerIds.add(handover.toUserDetailId);
    }
  }

  const itemIds = new Set(matches.flatMap((match) => match.obligations.map((o) => o.itemId)));

  const [people, titles] = await Promise.all([
    getPeople([...customerIds]),
    getTitles([...itemIds]),
  ]);
  return { people, titles };
}

async function render(matches: Match[]): Promise<MatchDto[]> {
  const obligationIds = matches.flatMap((match) => match.obligations.map((o) => o.id));
  const handovers = await MatchRepository.handoversForObligations(obligationIds);
  return toMatchDtos(matches, handovers, await buildLookups(matches, handovers));
}

/** Every match the given customer is a party to in a live round. */
export async function getMatchesForCustomer(customerId: string): Promise<MatchDto[]> {
  return render(await MatchRepository.findForCustomer(customerId));
}

/** One match by id, or null. Lets a detail page load without pulling its whole round. */
export async function getMatchById(matchId: number): Promise<MatchDto | null> {
  const match = await MatchRepository.findById(matchId);
  if (!match) {
    return null;
  }
  return (await render([match]))[0] ?? null;
}

/**
 * Every match in a round. Falls back to the newest live round when none is named, which is the
 * one an admin opening the overview almost always means.
 */
export async function getMatchesForRound(roundId?: number): Promise<MatchDto[]> {
  const round =
    roundId === undefined
      ? await MatchRepository.findDefaultRound()
      : await MatchRound.find(roundId);
  if (!round) {
    return [];
  }
  return render(await MatchRepository.findForRound(round.id));
}
