import MatchObligation from "#models/match_obligation";
import { dischargedHalves } from "#services/matches/match_repository";
import { getEquivalentItemIds } from "#shared/item-equivalence";

/**
 * Obligations that still bind a book to a student-to-student handover.
 *
 * Only active rounds are in play. Rounds accumulate now that they are rows rather than a
 * collection wiped between terms, so without this scoping a single stale obligation would make its
 * book warn at the stand forever — and a draft round an admin is still checking must stay inert
 * until it is activated.
 */
function liveObligations() {
  return MatchObligation.query().whereHas("match", (match) =>
    match.whereHas("round", (round) => round.where("status", "active")),
  );
}

/**
 * The student the customer is due to receive this title from, or null when nobody owes them one.
 * The stand may still hand the book out, but only after the employee has confirmed it. Equivalent
 * editions count as the same title, and oldest obligations are preferred so repeated scans report
 * a stable peer.
 */
async function findPeerSender(customerId: string, itemId: string): Promise<string | null> {
  const obligation = await liveObligations()
    .whereIn("itemId", getEquivalentItemIds(itemId))
    .whereHas("receiver", (receiver) => receiver.where("userDetailId", customerId))
    .whereHas("sender", (sender) => sender.whereNotNull("userDetailId"))
    .whereNotIn("id", dischargedHalves("receiver"))
    .orderBy("id", "asc")
    .preload("sender")
    .first();

  return obligation?.sender.userDetailId ?? null;
}

/**
 * The student a book the customer holds is due to go to, or null when nobody is waiting for it.
 * Scoped to the sender's undischarged half: once the customer's copy has demonstrably moved, the
 * stand may collect the book without a warning.
 */
async function findPeerRecipient(customerId: string, itemId: string): Promise<string | null> {
  const obligation = await liveObligations()
    .whereIn("itemId", getEquivalentItemIds(itemId))
    .whereHas("sender", (sender) => sender.where("userDetailId", customerId))
    .whereHas("receiver", (receiver) => receiver.whereNotNull("userDetailId"))
    .whereNotIn("id", dischargedHalves("sender"))
    .orderBy("id", "asc")
    .preload("receiver")
    .first();

  return obligation?.receiver.userDetailId ?? null;
}

export const PeerObligations = {
  findPeerSender,
  findPeerRecipient,
};
