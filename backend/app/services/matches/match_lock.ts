import MatchObligation from "#models/match_obligation";
import { dischargedHalves } from "#services/matches/match_repository";
import { getEquivalentItemIds } from "#shared/item-equivalence";

/**
 * Feedback shown when trying to return or buy back a book that is locked to a handover.
 * The customer must give the locked books to another student instead of delivering at a stand.
 */
export const ITEMS_LOCKED_TO_MATCH_RETURN_FEEDBACK =
  "Ordren inneholder bøker som er låst til en overlevering; kunden må overlevere de låste bøkene til en annen elev";

/**
 * Obligations that still bind a book to a particular student handover.
 *
 * A lock only means something while the book has not moved and the round is switched on. Rounds
 * accumulate now that they are rows rather than a collection wiped between terms, so without both
 * conditions a single locked obligation would make its book unreturnable forever — and a draft
 * round's locks must stay inert until an admin activates it.
 */
function liveLocks() {
  return MatchObligation.query()
    .where("lockedToMatch", true)
    .whereHas("match", (match) =>
      match.whereHas("round", (round) => round.where("status", "active")),
    );
}

/**
 * The subset of the given books whose owner must hand them to another student rather than to the
 * stand. One query however many books are passed in.
 */
async function findCustomerItemsLockedToMatch<T extends { customer: string; item: string }>(
  customerItems: T[],
): Promise<T[]> {
  if (customerItems.length === 0) return [];

  const locked = await liveLocks()
    .whereIn(
      "itemId",
      customerItems.flatMap((customerItem) => getEquivalentItemIds(customerItem.item)),
    )
    .whereHas("sender", (sender) =>
      sender.whereIn(
        "userDetailId",
        customerItems.map((customerItem) => customerItem.customer),
      ),
    )
    .whereNotIn("id", dischargedHalves("sender"))
    .preload("sender");

  const lockedOwnerTitles = new Set(
    locked.map((obligation) => `${obligation.sender.userDetailId}__${obligation.itemId}`),
  );
  return customerItems.filter((customerItem) =>
    getEquivalentItemIds(customerItem.item).some((itemId) =>
      lockedOwnerTitles.has(`${customerItem.customer}__${itemId}`),
    ),
  );
}

/**
 * Those of `itemIds` the customer is due to receive from another student, and so may not simply be
 * handed at the stand.
 */
async function findItemsLockedForReceiver(
  itemIds: string[],
  customerId: string,
): Promise<string[]> {
  if (itemIds.length === 0) return [];

  const locked = await liveLocks()
    .whereIn(
      "itemId",
      itemIds.flatMap((itemId) => getEquivalentItemIds(itemId)),
    )
    .whereHas("receiver", (receiver) => receiver.where("userDetailId", customerId))
    .whereNotIn("id", dischargedHalves("receiver"));

  const lockedTitles = new Set(locked.map((obligation) => obligation.itemId));
  return itemIds.filter((itemId) =>
    getEquivalentItemIds(itemId).some((equivalent) => lockedTitles.has(equivalent)),
  );
}

/**
 * The student a book the customer holds must be given to, or null when it is not locked to anyone.
 */
async function findLockedRecipient(customerId: string, itemId: string): Promise<string | null> {
  const obligation = await liveLocks()
    .whereIn("itemId", getEquivalentItemIds(itemId))
    .whereHas("sender", (sender) => sender.where("userDetailId", customerId))
    .whereNotIn("id", dischargedHalves("sender"))
    .preload("receiver")
    .first();

  return obligation?.receiver.userDetailId ?? null;
}

/**
 * The peer the customer is due to receive this title from, if any, and whether that handover is
 * locked. Unlocked matches are reported too: the stand may still hand the book out, but only after
 * the employee has confirmed it.
 */
async function findPeerSender(
  customerId: string,
  itemId: string,
): Promise<{ senderCustomerId: string; lockedToMatch: boolean } | null> {
  const obligation = await MatchObligation.query()
    .whereIn("itemId", getEquivalentItemIds(itemId))
    .whereHas("receiver", (receiver) => receiver.where("userDetailId", customerId))
    .whereHas("sender", (sender) => sender.whereNotNull("userDetailId"))
    .whereHas("match", (match) =>
      match.whereHas("round", (round) => round.where("status", "active")),
    )
    .whereNotIn("id", dischargedHalves("receiver"))
    .preload("sender")
    .first();

  if (!obligation?.sender.userDetailId) return null;
  return {
    senderCustomerId: obligation.sender.userDetailId,
    lockedToMatch: obligation.lockedToMatch,
  };
}

/**
 * Locks or unlocks every obligation in the student-to-student matches the customer takes part in —
 * both what they owe and what they are owed, since the lock describes the meeting rather than one
 * direction of it.
 *
 * Stand matches are exempt: a lock says "hand this to a student, not the stand", which would make
 * a book whose whole plan is a stand visit unreturnable. Only active rounds are touched: drafts
 * and switched-off rounds are not in play, so their locks are not either.
 */
async function setLockedForCustomer(customerId: string, locked: boolean): Promise<void> {
  await MatchObligation.query()
    .whereHas("match", (match) => {
      void match
        .whereHas("participants", (participant) => participant.where("userDetailId", customerId))
        .whereDoesntHave("participants", (participant) => participant.whereNull("userDetailId"))
        .whereHas("round", (round) => round.where("status", "active"));
    })
    .update({ lockedToMatch: locked });
}

export const MatchLock = {
  findCustomerItemsLockedToMatch,
  findItemsLockedForReceiver,
  findLockedRecipient,
  findPeerSender,
  setLockedForCustomer,
};
