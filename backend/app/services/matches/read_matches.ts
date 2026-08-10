import type BookHandover from "#models/book_handover";
import type Match from "#models/match";
import MatchRound from "#models/match_round";
import { MatchRepository } from "#services/matches/match_repository";
import { StorageService } from "#services/storage_service";
import type { MatchDto } from "#shared/match/match-dto";
import { USER_PERMISSION } from "#shared/user-permission";
import { toMatchDtos, type MatchLookups, type MatchPerson } from "#transformers/match_transformer";

/**
 * Fetched with admin permission, which skips the active-only filter. A student who has been
 * deactivated mid-round is still a party to their matches, and the admin overview must show them.
 */
async function getPeople(customerIds: string[]): Promise<Map<string, MatchPerson>> {
  if (customerIds.length === 0) return new Map();
  const userDetails = await StorageService.UserDetails.getMany(customerIds, USER_PERMISSION.ADMIN);
  return new Map(
    userDetails.map((detail) => [
      detail.id,
      { name: detail.name ?? "", phone: detail.phone ?? "", email: detail.email ?? "" },
    ]),
  );
}

/** Admin permission for the same reason: an item deactivated mid-round must keep its title. */
async function getTitles(itemIds: string[]): Promise<Map<string, string>> {
  if (itemIds.length === 0) return new Map();
  const items = await StorageService.Items.getMany(itemIds, USER_PERMISSION.ADMIN);
  return new Map(items.map((item) => [item.id, item.title]));
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
      if (participant.userDetailId !== null) customerIds.add(participant.userDetailId);
    }
  }
  for (const handover of handovers) {
    if (handover.fromUserDetailId !== null) customerIds.add(handover.fromUserDetailId);
    if (handover.toUserDetailId !== null) customerIds.add(handover.toUserDetailId);
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
  if (!match) return null;
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
  if (!round) return [];
  return render(await MatchRepository.findForRound(round.id));
}
