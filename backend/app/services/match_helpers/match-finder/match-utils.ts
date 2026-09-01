import type {
  CandidateStandMatch,
  CandidateUserMatch,
  MatchableUser,
} from "#services/match_helpers/match-finder/match-types";

/**
 * Create a sorted deep copy of the input users
 * @param users
 */
export function copyUsers(users: MatchableUser[]): MatchableUser[] {
  return users.map((user) => ({
    id: user.id,
    items: new Set(user.items),
    wantedItems: new Set(user.wantedItems),
    groupMembership: user.groupMembership,
  }));
}

/**
 * Sort users, prioritizing:
 * 1. Users without a stand match.
 * 2. Descending number of items.
 * 3. Descending number of wanted items.
 * @param users - List of users to sort.
 * @param standMatches - List of stand matches to check against.
 * @returns sortedUsers - List of sorted users
 */
export function sortUsers(
  users: MatchableUser[],
  standMatches: CandidateStandMatch[],
): MatchableUser[] {
  const customersWithStandMatch = new Set(standMatches.map((standMatch) => standMatch.customer));
  return users.toSorted((a, b) => {
    const aHasStandMatch = customersWithStandMatch.has(a.id);
    const bHasStandMatch = customersWithStandMatch.has(b.id);

    if (aHasStandMatch && !bHasStandMatch) {
      return 1;
    }
    if (!aHasStandMatch && bHasStandMatch) {
      return -1;
    }

    if (b.items.size !== a.items.size) {
      return b.items.size - a.items.size;
    }

    return b.wantedItems.size - a.wantedItems.size;
  });
}

/**
 * Removes fully matched users, aka. users that have no items and no wantedItems
 *
 * @param users the set of users to be cleaned
 * @returns a shallow copy of the users list without the fully matched users
 */
export function removeFullyMatchedUsers(users: MatchableUser[]): MatchableUser[] {
  return users.filter((user) => user.items.size > 0 || user.wantedItems.size > 0);
}

/**
 * Try to find a match that has the exact same items
 * as the user. These two are "perfect matches", as they
 * only have to interact with one person when matching.
 * @param user The user to be matched
 * @param userGroup The userGroup to match against
 */
export function tryFindTwoWayMatch(
  user: MatchableUser,
  userGroup: MatchableUser[],
): MatchableUser | null {
  return (
    userGroup.find(
      (candidate) =>
        user.id !== candidate.id &&
        !(user.wantedItems.symmetricDifference(candidate.items).size > 0) &&
        !(candidate.wantedItems.symmetricDifference(user.items).size > 0),
    ) ?? null
  );
}

/**
 * Try to find a matching user that want to exchange as many items as possible with the user
 * @param user The user to be matched
 * @param userGroup The user group to match against
 * @returns the matching user with maximum number of exchangeable items, or null if none match
 */
export function tryFindPartialMatch(
  user: MatchableUser,
  userGroup: MatchableUser[],
): MatchableUser | null {
  let bestCandidate: MatchableUser | null = null;
  for (const candidate of userGroup) {
    if (user.id === candidate.id) {
      continue;
    }
    const userToCandidateItems = user.items.intersection(candidate.wantedItems);
    const candidateToUserItems = candidate.items.intersection(user.wantedItems);

    const userToBestCandidateItems = user.items.intersection(
      bestCandidate?.wantedItems ?? new Set(),
    );
    const bestCandidateToUserItems = (bestCandidate?.items ?? new Set()).intersection(
      user.wantedItems,
    );

    const candidateMatchNumberOfItems = userToCandidateItems.size + candidateToUserItems.size;
    const bestCandidateMatchNumberOfItems =
      userToBestCandidateItems.size + bestCandidateToUserItems.size;

    if (candidateMatchNumberOfItems > bestCandidateMatchNumberOfItems) {
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}

/**
 * Count occurrences of each item list
 * @param items
 */
export function countItemOccurrences(items: string[]): Record<string, number> {
  return items.reduce(
    (accumulator: Record<string, number>, next) => ({
      ...accumulator,
      [next]: (accumulator[next] ?? 0) + 1,
    }),
    {},
  );
}

/**
 *
 * For each item, calculate the number to be sent minus number to be received.
 * @param itemsCounts - The grouped items of the senders.
 * @param wantedItemsCounts - The grouped items of the receivers.
 * @returns An object where the keys are the items and the values are the differences between number of that item given
 * by senders and wanted by receivers.
 * @private
 */
export function calculateItemImbalances(
  itemsCounts: Record<string, number>,
  wantedItemsCounts: Record<string, number>,
): Record<string, number> {
  return Object.keys({ ...wantedItemsCounts, ...itemsCounts }).reduce((diffs, item) => {
    const itemCount = itemsCounts[item] ?? 0;
    const wantedItemCount = wantedItemsCounts[item] ?? 0;

    return {
      ...diffs,
      [item]: itemCount - wantedItemCount,
    };
  }, {});
}

/**
 * Checks if a full stand match can be made for a user
 * so that they are fulfilled
 * @param user - The user to check
 * @param itemImbalances - The imbalances in item counts
 * @returns True if a full stand match can be made, false otherwise
 * @private
 *
 **/
export function canMatchPerfectlyWithStand(
  user: MatchableUser,
  itemImbalances: Record<string, number>,
): boolean {
  const canDeliverItems = [...user.items].every((item) => (itemImbalances[item] ?? 0) > 0);
  const canReceiveWantedItems = [...user.wantedItems].every(
    (item) => (itemImbalances[item] ?? 0) < 0,
  );
  return canDeliverItems && canReceiveWantedItems;
}

/**
 * Updates the imbalance count for each item of a user after the given match
 * @param items - The items to update the difference for
 * @param wantedItems - The wanted items to update the difference for
 * @param itemImbalances - The imbalances in item counts
 * @private
 */
export function updateItemImbalances(
  items: Set<string>,
  wantedItems: Set<string>,
  itemImbalances: Record<string, number>,
): void {
  for (const item of items) {
    itemImbalances[item] = (itemImbalances[item] ?? 0) - 1;
  }
  for (const wantedItem of wantedItems) {
    itemImbalances[wantedItem] = (itemImbalances[wantedItem] ?? 0) + 1;
  }
}

/**
 * Calculate which items cannot be matched.
 * Aka. either no one wants the items, or no one has the items
 */
export function calculateUnmatchableItems(users: MatchableUser[]): Set<string> {
  const items = new Set(users.flatMap((user) => [...user.items]));
  const wantedItems = new Set(users.flatMap((user) => [...user.wantedItems]));
  return items.symmetricDifference(wantedItems);
}

export function countMatchesForEachUser(
  userMatches: CandidateUserMatch[],
  standMatches: CandidateStandMatch[],
) {
  const matchesPerUser = new Map<string, { userMatches: number; standMatches: number }>();
  for (const userMatch of userMatches) {
    const existingCustomerA = matchesPerUser.get(userMatch.customerA);
    const existingCustomerB = matchesPerUser.get(userMatch.customerB);
    if (existingCustomerA) {
      existingCustomerA.userMatches++;
    } else {
      matchesPerUser.set(userMatch.customerA, {
        userMatches: 1,
        standMatches: 0,
      });
    }
    if (existingCustomerB) {
      existingCustomerB.userMatches++;
    } else {
      matchesPerUser.set(userMatch.customerB, {
        userMatches: 1,
        standMatches: 0,
      });
    }
  }
  for (const standMatch of standMatches) {
    const existingCustomer = matchesPerUser.get(standMatch.customer);
    if (existingCustomer) {
      existingCustomer.standMatches++;
    } else {
      matchesPerUser.set(standMatch.customer, {
        userMatches: 0,
        standMatches: 1,
      });
    }
  }
  return matchesPerUser;
}
