import BadRequestException from "#exceptions/bad_request_exception";
import { MatchRepository } from "#services/matches/match_repository";
import { getEquivalentItemIds } from "#shared/item-equivalence";

/**
 * Item ids the given customer may not cancel an order for, because a user match in an active
 * round depends on them. Match lock is irrelevant here: an unlocked match still binds two
 * students, so cancellation is never allowed. Equivalent editions are included, since a match
 * obligation for one edition can be satisfied by an ordered copy of another.
 */
export async function itemIdsInActiveUserMatches(customerId: string): Promise<Set<string>> {
  const matches = await MatchRepository.findForCustomer(customerId);
  const blocked = new Set<string>();
  for (const match of matches) {
    if (match.participants.some((participant) => participant.isStand)) continue;
    for (const obligation of match.obligations) {
      for (const itemId of getEquivalentItemIds(obligation.itemId)) {
        blocked.add(itemId);
      }
    }
  }
  return blocked;
}

export async function assertNotBlockedByUserMatch(customerId: string, itemId: string) {
  const blockedItemIds = await itemIdsInActiveUserMatches(customerId);
  if (blockedItemIds.has(itemId)) {
    throw new BadRequestException(
      "Boka er en del av en overlevering med en annen elev og kan ikke avbestilles",
    );
  }
}
