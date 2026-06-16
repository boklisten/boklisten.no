import { itemsAreEquivalent } from "#shared/item-equivalence";
import { UserMatch } from "#shared/match/user-match";

/**
 * Feedback shown when trying to return/buy back a customerItem that is locked to a UserMatch.
 * The customer must hand the locked books over to another student instead of delivering at a stand.
 */
export const ITEMS_LOCKED_TO_MATCH_RETURN_FEEDBACK =
  "Ordren inneholder bøker som er låst til en UserMatch; kunden må overlevere de låste bøkene til en annen elev";

/**
 * Whether the given customer has a locked UserMatch that contains the given item.
 */
function isItemLockedToMatch(customer: string, item: string, userMatches: UserMatch[]): boolean {
  return userMatches.some(
    (userMatch) =>
      userMatch.itemsLockedToMatch &&
      (userMatch.customerA === customer || userMatch.customerB === customer) &&
      (userMatch.expectedAToBItems.includes(item) || userMatch.expectedBToAItems.includes(item)),
  );
}

/**
 * For a customer holding an item locked to a UserMatch, returns the id of the other customer in
 * that match — the student the book must be handed over to. Returns null if the item is not locked
 * to any of the customer's matches.
 */
function findMatchRecipientCustomerId(
  customer: string,
  item: string,
  userMatches: UserMatch[],
): string | null {
  const match = userMatches.find(
    (userMatch) =>
      userMatch.itemsLockedToMatch &&
      (userMatch.customerA === customer || userMatch.customerB === customer) &&
      (userMatch.expectedAToBItems.includes(item) || userMatch.expectedBToAItems.includes(item)),
  );
  if (!match) return null;
  return match.customerA === customer ? match.customerB : match.customerA;
}

/**
 * Returns the UserMatch (if any) in which the given customer is expected to *receive* an item
 * equivalent to the given one from the other student. Used by rapid handout to detect books that
 * should come from a peer rather than be handed out at the stand. Returns null when no such match
 * exists. The returned match's `itemsLockedToMatch` tells whether stand handout is blocked.
 */
function findReceivingUserMatch(
  customer: string,
  item: string,
  userMatches: UserMatch[],
): UserMatch | null {
  return (
    userMatches.find((userMatch) => {
      if (userMatch.customerA === customer) {
        return userMatch.expectedBToAItems.some((expected) => itemsAreEquivalent(expected, item));
      }
      if (userMatch.customerB === customer) {
        return userMatch.expectedAToBItems.some((expected) => itemsAreEquivalent(expected, item));
      }
      return false;
    }) ?? null
  );
}

/**
 * The id of the other student in a UserMatch, i.e. the one the given customer interacts with.
 */
function getMatchCounterpartCustomerId(customer: string, userMatch: UserMatch): string {
  return userMatch.customerA === customer ? userMatch.customerB : userMatch.customerA;
}

/**
 * Returns the subset of the given customerItems that are locked to one of their owner's UserMatches.
 */
function findCustomerItemsLockedToMatch<T extends { customer: string; item: string }>(
  customerItems: T[],
  userMatches: UserMatch[],
): T[] {
  return customerItems.filter((customerItem) =>
    isItemLockedToMatch(customerItem.customer, customerItem.item, userMatches),
  );
}

export const MatchLockService = {
  isItemLockedToMatch,
  findMatchRecipientCustomerId,
  findReceivingUserMatch,
  getMatchCounterpartCustomerId,
  findCustomerItemsLockedToMatch,
};
