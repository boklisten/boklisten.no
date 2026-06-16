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
  findCustomerItemsLockedToMatch,
};
