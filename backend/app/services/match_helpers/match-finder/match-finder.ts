import logger from "@adonisjs/core/services/logger";

import {
  calculateItemImbalances,
  calculateUnmatchableItems,
  canMatchPerfectlyWithStand,
  copyUsers,
  countItemOccurrences,
  countMatchesForEachUser,
  removeFullyMatchedUsers,
  sortUsers,
  tryFindPartialMatch,
  tryFindTwoWayMatch,
  updateItemImbalances,
} from "#services/match_helpers/match-finder/match-utils";
import { BlError } from "#shared/bl-error";
import type {
  CandidateStandMatch,
  CandidateUserMatch,
  MatchableUser,
} from "#services/match_helpers/match-finder/match-types";

/**
 * ****Some useful terms****
 *
 * When a user is...
 * - *fully matched*, all their items and wantedItems have been assigned to matches
 * - *partially matched*, some of their items or wantedItems have been assigned to matches
 *
 * ***Matching strategies***
 *
 * - *FullMatch*, a match where both users become fully matched
 * - *PartialMatch*, a match where we try to satisfy as many items as possible
 *
 */

export class MatchFinder {
  public users: MatchableUser[];
  private userGroups = new Map<string, MatchableUser[]>();

  // items that either no one has or no one wants
  public unmatchableItems = new Set<string>();

  private userMatches: CandidateUserMatch[] = [];
  private standMatches: CandidateStandMatch[] = [];
  private readonly MAX_USER_MATCH_COUNT = 4;

  constructor(private readonly _users: MatchableUser[]) {
    this.users = copyUsers(_users);
    this.verifyMatchableUsers();
    this.groupUsersByMembership();
  }

  /**
   * Trigger generation of matches
   * @returns an optimal matching of the given users
   */
  public generateMatches(): [CandidateUserMatch[], CandidateStandMatch[]] {
    this.logMatchingStatus("MatchFinder is starting");
    this.logGroupStatus("Initial");
    this.logGroupItemDemands();

    this.createTwoWayMatches();

    this.createFullStandMatches();

    let iterations = 0;
    while (this.users.length > 0) {
      iterations++;
      this.users = sortUsers(this.users, this.standMatches);
      this.createMatches(tryFindPartialMatch, this.users);
      this.logMatchingStatus(`Partial matching iteration ${iterations} complete`);
    }
    this.logPerformanceMetrics();

    this.verifyMatches();
    return [this.userMatches, this.standMatches];
  }

  private createTwoWayMatches() {
    for (const [groupId, users] of this.userGroups
      .entries()
      .toArray()
      .sort((a, b) => a[0].localeCompare(b[0]))) {
      this.createMatches(tryFindTwoWayMatch, users);
      this.logMatchingStatus(`Created TwoWayMatches for ${groupId}`);
    }
    const ratioCache = new Map<string, { successRate: number; numberOfMatches: number }>();
    const fingerprint = (users: MatchableUser[]) => {
      let items = 0;
      let wantedItems = 0;
      for (const user of users) {
        items += user.items.size;
        wantedItems += user.wantedItems.size;
      }
      return `${users.length}:${items}:${wantedItems}`;
    };
    while (this.userGroups.size > 1) {
      const iterableUserGroups = this.userGroups.entries().toArray();
      let bestGrouping: {
        groupA: string;
        groupB: string;
        successRate: number;
        numberOfMatches: number;
      } | null = null;
      for (let i = 0; i < this.userGroups.size - 1; i++) {
        for (let j = i + 1; j < this.userGroups.size; j++) {
          const [groupA, usersA] = iterableUserGroups[i] ?? [];
          const [groupB, usersB] = iterableUserGroups[j] ?? [];
          if (!groupA || !groupB || !usersA || !usersB) {
            throw new BlError("group A and B cannot be undefined");
          }
          const cacheKey = `${groupA}(${fingerprint(usersA)})|${groupB}(${fingerprint(usersB)})`;
          let ratio = ratioCache.get(cacheKey);
          if (!ratio) {
            ratio = this.evaluateTwoWayMatchRatio([...usersA, ...usersB]);
            ratioCache.set(cacheKey, ratio);
          }
          const { successRate, numberOfMatches } = ratio;
          if (
            bestGrouping === null ||
            (successRate > bestGrouping.successRate &&
              numberOfMatches >= bestGrouping.numberOfMatches)
          ) {
            bestGrouping = {
              groupA,
              groupB,
              successRate,
              numberOfMatches,
            };
          }
        }
      }
      if (!bestGrouping) throw new BlError("Failed to find a compatible userGroup pair");

      const joinedGroupId = [bestGrouping.groupA, bestGrouping.groupB]
        .sort((a, b) => a.localeCompare(b))
        .join("+");
      for (const user of this.users) {
        if (
          user.groupMembership === bestGrouping.groupA ||
          user.groupMembership === bestGrouping.groupB
        ) {
          user.groupMembership = joinedGroupId;
        }
      }
      this.groupUsersByMembership();
      this.createMatches(tryFindTwoWayMatch, this.userGroups.get(joinedGroupId) ?? []);
      this.logMatchingStatus(
        `Created ${bestGrouping.numberOfMatches} TwoWayMatches for new group ${joinedGroupId} (${(bestGrouping.successRate * 100).toPrecision(3)}% match)`,
      );
      this.logGroupStatus("Current");
    }
    this.logMatchingStatus("TwoMatching Complete");
  }

  private groupUsersByMembership() {
    this.userGroups = new Map();
    for (const user of this.users) {
      const existingGroup = this.userGroups.get(user.groupMembership);
      if (existingGroup) {
        existingGroup.push(user);
      } else {
        this.userGroups.set(user.groupMembership, [user]);
      }
    }
  }

  private verifyMatchableUsers() {
    const foundUsers = new Set();
    for (const user of this.users) {
      if (foundUsers.has(user.id)) {
        throw new BlError("Found duplicates in this.users");
      }
      foundUsers.add(user.id);

      if (user.items.intersection(user.wantedItems).size > 0) {
        // fixme: we might want to ignore this, since we intend to let people have two of the same item sometimes
        // throw new BlError("Users cannot want items that they already have");
      }
    }
  }

  /**
   * Verify that all users have legal matches for all their items.
   */
  private verifyMatches() {
    this.users = removeFullyMatchedUsers(this.users);

    if (this.users.length > 0) {
      throw new BlError("Some users did not receive a match!");
    }

    let originalUsers = copyUsers(this._users);

    const userMatchCounts: Record<string, number> = {};
    for (const userMatch of this.userMatches) {
      if (userMatch.customerA === userMatch.customerB) {
        throw new BlError("Users cannot be matched with themselves!");
      }
      userMatchCounts[userMatch.customerA] = (userMatchCounts[userMatch.customerA] ?? 0) + 1;
      userMatchCounts[userMatch.customerB] = (userMatchCounts[userMatch.customerB] ?? 0) + 1;

      const originalCustomerA = originalUsers.find((u) => u.id === userMatch.customerA);
      const originalCustomerB = originalUsers.find((u) => u.id === userMatch.customerB);

      if (!originalCustomerA || !originalCustomerB) {
        throw new BlError("Match participant must exist in the original MatchableUsers");
      }

      if (
        userMatch.expectedAToBItems.difference(originalCustomerA.items).size > 0 ||
        userMatch.expectedBToAItems.difference(originalCustomerB.items).size > 0
      ) {
        throw new BlError("Users cannot give away more books than they have!");
      }
      if (
        userMatch.expectedBToAItems.difference(originalCustomerA.wantedItems).size > 0 ||
        userMatch.expectedAToBItems.difference(originalCustomerB.wantedItems).size > 0
      ) {
        throw new BlError("Users cannot receive books they do not want!");
      }
      originalCustomerA.items = originalCustomerA.items.difference(userMatch.expectedAToBItems);
      originalCustomerA.wantedItems = originalCustomerA.wantedItems.difference(
        userMatch.expectedBToAItems,
      );

      originalCustomerB.items = originalCustomerB.items.difference(userMatch.expectedBToAItems);
      originalCustomerB.wantedItems = originalCustomerB.wantedItems.difference(
        userMatch.expectedAToBItems,
      );
    }
    if (
      Object.values(userMatchCounts).some(
        (userMatchCount) => userMatchCount > this.MAX_USER_MATCH_COUNT,
      )
    ) {
      throw new BlError(`Users cannot have more than ${this.MAX_USER_MATCH_COUNT} user matches!`);
    }

    const usersWithStandMatch = new Set<string>();
    for (const standMatch of this.standMatches) {
      if (usersWithStandMatch.has(standMatch.customer)) {
        throw new BlError("Users can only have one stand match!");
      }
      usersWithStandMatch.add(standMatch.customer);

      const originalCustomer = originalUsers.find((u) => u.id === standMatch.customer);

      if (!originalCustomer) {
        throw new BlError("Stand Match user must exist in the original MatchableUsers");
      }

      if (standMatch.expectedHandoffItems.difference(originalCustomer.items).size > 0) {
        throw new BlError("Users cannot give away more books than they have!");
      }
      if (standMatch.expectedPickupItems.difference(originalCustomer.wantedItems).size > 0) {
        throw new BlError("Users cannot receive books they do not want!");
      }

      originalCustomer.items = originalCustomer.items.difference(standMatch.expectedHandoffItems);
      originalCustomer.wantedItems = originalCustomer.wantedItems.difference(
        standMatch.expectedPickupItems,
      );
    }

    originalUsers = removeFullyMatchedUsers(originalUsers);

    if (originalUsers.length > 0) {
      throw new BlError("Some senders or receivers did not get fulfilled");
    }
  }

  /**
   * Identifies items that cannot be matched
   * (no one wants them, or no one has them) and creates stand matches for them.
   * @private
   */
  private standMatchUnmatchableItems() {
    const newUnmatchableItems = calculateUnmatchableItems(this.users);
    const uncheckedUnmatchableItems = newUnmatchableItems.difference(this.unmatchableItems);

    if (uncheckedUnmatchableItems.size > 0) {
      this.logItemDemand(this.users);
      logger.debug(
        `🕵️‍♀️ Detected unmatchable items: ${Array.from(uncheckedUnmatchableItems).join(", ")}`,
      );
      this.unmatchableItems = this.unmatchableItems.union(newUnmatchableItems);
      let count = 0;
      for (const user of this.users) {
        const created = this.createStandMatch(user, this.unmatchableItems);
        if (created) count++;
      }
      if (count > 0) {
        logger.debug(`🧹 Created ${count} StandMatches for unmatchable items`);
      }
    }
  }

  /**
   * Creates initial stand matches for users
   * This method groups users items by count and calculates the imbalance between them
   * After that, it checks if a full stand match can be made for each sender and receiver
   * If a full stand match can be made, it updates the difference and creates a stand match
   * @private
   */
  private createFullStandMatches() {
    const itemCounts = countItemOccurrences(this.users.flatMap((user) => Array.from(user.items)));
    const wantedItemCounts = countItemOccurrences(
      this.users.flatMap((user) => Array.from(user.wantedItems)),
    );
    const itemImbalances = calculateItemImbalances(itemCounts, wantedItemCounts);

    this.logItemDemand(this.users);
    this.createImbalanceMinimizingStandMatches(this.users, itemImbalances);
    this.logMatchingStatus(
      "Tried to create imbalance minimizing stand matches, here are the results",
    );
    this.logItemDemand(this.users);
  }

  /**
   * Creates stand matches for a list of users
   * This method checks if a full stand match can be made for each user
   * If a full stand match can be made, it updates the difference in counts and creates a stand match
   * @param users - The users for whom to create matches
   * @param itemImbalances - An object where the keys are the items and the values are the differences between number of that item given
   * * by senders and wanted by receivers.
   * @private
   */
  private createImbalanceMinimizingStandMatches(
    users: MatchableUser[],
    itemImbalances: Record<string, number>,
  ) {
    // Process those who have stand matches first, then those with the fewest amount of items/wanted
    this.users = sortUsers(this.users, this.standMatches).toReversed();
    for (const user of users) {
      if (canMatchPerfectlyWithStand(user, itemImbalances)) {
        updateItemImbalances(user.items, user.wantedItems, itemImbalances);
        this.createStandMatch(user, new Set([...user.items, ...user.wantedItems]));
      }
    }
  }

  /**
   * This method checks if a user has reached the maximum limit for UserMatches,
   * and if so, creates a stand match for the user where the remainder of their items are handled by stand
   *
   * @param user - The user for whom the stand match may be created.
   *
   * @private
   */
  private createStandMatchIfReachedMatchLimit(user: MatchableUser) {
    const userMatches = this.userMatches.filter(
      (userMatch) => userMatch.customerA === user.id || userMatch.customerB === user.id,
    );

    if (userMatches.length >= this.MAX_USER_MATCH_COUNT) {
      this.createStandMatch(user, new Set([...user.items, ...user.wantedItems]));
    }
  }

  /**
   * This method calculates what percentage of a userGroup could be completely matched within that group
   * @param userGroup the userGroup to be tested on
   * @returns a number between 0 and 1 denoting the percentage of the group that would result in a match
   * @private
   */
  private evaluateTwoWayMatchRatio(userGroup: MatchableUser[]): {
    successRate: number;
    numberOfMatches: number;
  } {
    if (userGroup.length === 0) {
      throw new BlError("evaluateTwoWayMatchRatio was called on a userGroup without any users!");
    }
    let localUserPool = copyUsers(userGroup);
    let stillFindingMatches = true;
    let matchCount = 0;
    while (stillFindingMatches) {
      stillFindingMatches = false;
      for (const user of localUserPool) {
        const matchedUser = tryFindTwoWayMatch(user, localUserPool);
        if (matchedUser) {
          stillFindingMatches = true;
          user.items = new Set();
          user.wantedItems = new Set();
          matchedUser.items = new Set();
          matchedUser.wantedItems = new Set();
          matchCount++;
          break;
        }
      }
      localUserPool = removeFullyMatchedUsers(localUserPool);
    }

    const notMatched = localUserPool.filter(
      (user) => user.wantedItems.size > 0 || user.items.size > 0,
    );
    return {
      numberOfMatches: matchCount,
      successRate:
        notMatched.length === 0 ? 1 : (userGroup.length - notMatched.length) / userGroup.length,
    };
  }

  /**
   * Create matches for senders fround from a given matchFinder function
   * Create delivery matches for unmatchable items
   * @param matchFinder a function that finds a match for a given sender
   * @param userGroup the group of users to create matches of
   * @private
   */
  private createMatches(
    matchFinder: (user: MatchableUser, userGroup: MatchableUser[]) => MatchableUser | null,
    userGroup: MatchableUser[],
  ) {
    const sortedUserGroup = sortUsers(userGroup, this.standMatches);
    for (const user of sortedUserGroup) {
      this.standMatchUnmatchableItems();

      // If all items are unmatchable, the sender is fully matched
      if (user.items.size === 0 && user.wantedItems.size === 0) {
        continue;
      }
      const matchedUser = matchFinder(user, sortedUserGroup);

      if (matchedUser === null) {
        if (matchFinder === tryFindPartialMatch) {
          // If there is no partial receiver, no one wants any of these items.
          // Thus, the items should be delivered to a stand and marked unmatchable
          this.unmatchableItems = this.unmatchableItems.union(user.items);
          this.createStandMatch(user, this.unmatchableItems);
        }
        continue;
      }

      this.createUserMatch(user, matchedUser);

      this.createStandMatchIfReachedMatchLimit(user);
      this.createStandMatchIfReachedMatchLimit(matchedUser);
    }

    // Cleanup senders and receivers
    this.users = removeFullyMatchedUsers(this.users);
    this.groupUsersByMembership();
  }

  /**
   * Match all overlapping items and wanted items between a sender and a receiver,
   * and remove their matched items.
   * @param userA - User sending items.
   * @param userB - User receiving items.
   * @private
   */
  private createUserMatch(userA: MatchableUser, userB: MatchableUser) {
    const AToBItems = userB.wantedItems.intersection(userA.items);
    const BToAItems = userA.wantedItems.intersection(userB.items);

    this.userMatches.push({
      customerA: userA.id,
      customerB: userB.id,
      expectedAToBItems: AToBItems,
      expectedBToAItems: BToAItems,
    });

    userA.items = userA.items.difference(AToBItems);
    userA.wantedItems = userA.wantedItems.difference(BToAItems);

    userB.items = userB.items.difference(BToAItems);
    userB.wantedItems = userB.wantedItems.difference(AToBItems);
  }

  /**
   * Match all specified items with the stand,
   * as either a handoffs or pickups,
   * and append the match to the list of stand matches
   * @param user
   * @param items the items to handled by the stand
   * @private
   */
  private createStandMatch(user: MatchableUser, items: Set<string>) {
    const newHandoffItems = user.items.intersection(items);
    const newPickupItems = user.wantedItems.intersection(items);
    if (newPickupItems.size === 0 && newHandoffItems.size === 0) {
      return false;
    }

    const existingStandMatch = this.standMatches.find(
      (standMatch) => standMatch.customer === user.id,
    );

    if (existingStandMatch) {
      existingStandMatch.expectedHandoffItems =
        existingStandMatch.expectedHandoffItems.union(newHandoffItems);
      existingStandMatch.expectedPickupItems =
        existingStandMatch.expectedPickupItems.union(newPickupItems);
    } else {
      this.standMatches.push({
        expectedHandoffItems: newHandoffItems,
        expectedPickupItems: newPickupItems,
        customer: user.id,
      });
    }

    user.items = user.items.difference(newHandoffItems);
    user.wantedItems = user.wantedItems.difference(newPickupItems);
    return true;
  }

  private calculateItemDemand(users: MatchableUser[]) {
    const itemMap: Record<string, { total: number; wanted: number }> = {};

    for (const user of users) {
      for (const item of user.items) {
        if (!itemMap[item]) {
          itemMap[item] = { total: 0, wanted: 0 };
        }
        itemMap[item].total++;
      }

      for (const item of user.wantedItems) {
        if (!itemMap[item]) {
          itemMap[item] = { total: 0, wanted: 0 };
        }
        itemMap[item].wanted++;
      }
    }
    return itemMap;
  }

  private logMatchingStatus(message: string) {
    logger.debug(
      `🔗${message} - Currently at ${this.userMatches.length} UserMatches and ${this.standMatches.length} StandMatches. ${this.users.length} users remaining.`,
    );
  }
  private logGroupStatus(message?: string) {
    if (this.userGroups.size === 0) return;
    logger.debug(
      ` ${message} Groups (${this.userGroups.size}): ${this.userGroups
        .entries()
        .toArray()
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, value]) => `${key}: ${value.length} users`)
        .join(", ")}\n`,
    );
  }

  private logItemDemand(users: MatchableUser[]): void {
    const sortedItems = Object.entries(this.calculateItemDemand(users)).sort((a, b) => {
      const totalDiff = b[1].total - a[1].total;
      if (totalDiff !== 0) return totalDiff;
      return b[1].wanted - a[1].wanted;
    });
    if (sortedItems.keys().toArray().length === 0) return;

    logger.debug(
      `Remaining Items:\n${sortedItems
        .map((item) => `${item[0]}: ${item[1].total} (${item[1].wanted} wanted)`)
        .join("\n")}`,
    );
  }

  private logGroupItemDemands() {
    logger.debug("Demand for each group");
    for (const [key, value] of this.userGroups
      .entries()
      .toArray()
      .sort((a, b) => a[0].localeCompare(b[0]))) {
      logger.debug("---\nDemand for " + key);
      this.logItemDemand(value);
    }
    logger.debug("---\n");
  }

  /**
   * Utility method to print some stats about the matching
   * so that one can evaluate the performance of the matching
   */
  private logPerformanceMetrics() {
    logger.debug("\n");
    this.logMatchingStatus("MatchFinder is done.");
    let totalUserMatchItems = 0;
    for (const userMatch of this.userMatches) {
      totalUserMatchItems += userMatch.expectedAToBItems.size + userMatch.expectedBToAItems.size;
    }

    let totalItems = 0;
    let totalWants = 0;
    for (const originalUser of this._users) {
      totalItems += originalUser.items.size;
      totalWants += originalUser.wantedItems.size;
    }

    const pickupCounts = new Map<string, number>();
    const handoffCounts = new Map<string, number>();
    let totalPickups = 0;
    let totalHandoffs = 0;
    let usersWithPickups = 0;
    let usersWithHandoffs = 0;
    for (const standMatch of this.standMatches) {
      if (standMatch.expectedPickupItems.size > 0) {
        usersWithPickups++;
      }
      if (standMatch.expectedHandoffItems.size > 0) {
        usersWithHandoffs++;
      }
      totalPickups += standMatch.expectedPickupItems.size;
      totalHandoffs += standMatch.expectedHandoffItems.size;
      for (const expectedPickupItem of standMatch.expectedPickupItems) {
        const pickupCount = pickupCounts.get(expectedPickupItem);
        if (pickupCount) {
          pickupCounts.set(expectedPickupItem, pickupCount + 1);
        } else {
          pickupCounts.set(expectedPickupItem, 1);
        }
      }
      for (const expectedHandoffItem of standMatch.expectedHandoffItems) {
        const handoffCount = handoffCounts.get(expectedHandoffItem);
        if (handoffCount) {
          handoffCounts.set(expectedHandoffItem, handoffCount + 1);
        } else {
          handoffCounts.set(expectedHandoffItem, 1);
        }
      }
    }

    logger.debug(
      `Started with ${this._users.length} users with ${totalItems} books, wanting ${totalWants} books`,
    );
    const totalItemMovements = totalItems + totalWants;

    logger.debug(
      // Need to multiply by 2 size each item transferred satisfies the needs of two people, the sender and the receiver
      `${totalUserMatchItems} books (${((100 * 2 * totalUserMatchItems) / totalItemMovements).toPrecision(3)}%) will be transferred through users, ${totalHandoffs + totalPickups} books (${((100 * (totalHandoffs + totalPickups)) / totalItemMovements).toPrecision(3)}%) will be handled by stand. `,
    );
    const onlyUserMatches = this._users.length - this.standMatches.length;
    logger.debug(
      `${onlyUserMatches} users (${((100 * onlyUserMatches) / this._users.length).toPrecision(3)}%) will only have user matches, while ${this.standMatches.length} users (${((100 * this.standMatches.length) / this._users.length).toPrecision(3)}%) will need to visit the stand`,
    );

    // Number of customers that need to visit stand vs not having to visit
    const groupedUsers = countMatchesForEachUser(this.userMatches, this.standMatches);
    const matchConfigSetups = new Map<string, number>();
    for (const { userMatches, standMatches } of groupedUsers.values()) {
      const key = `${userMatches} UserMatches ${standMatches} StandMatches`;
      const existingEntry = matchConfigSetups.get(key);
      if (existingEntry) {
        matchConfigSetups.set(key, existingEntry + 1);
      } else {
        matchConfigSetups.set(key, 1);
      }
    }

    logger.debug("\nPerformance metrics:");
    for (const [setup, numberOfUsers] of matchConfigSetups
      .entries()
      .toArray()
      .sort((a, b) => {
        const byNumberOfCustomers = b[1] - a[1];
        if (byNumberOfCustomers !== 0) return byNumberOfCustomers;
        return b[0].localeCompare(a[0]);
      })) {
      logger.debug(`${setup}: ${numberOfUsers} users`);
    }

    logger.debug(
      `\nStand is receiving ${totalHandoffs} books from ${usersWithHandoffs} customers, distributed as follows:`,
    );
    for (const [item, count] of handoffCounts
      .entries()
      .toArray()
      .sort((a, b) => b[1] - a[1])) {
      logger.debug(`${item}: ${count}`);
    }
    logger.debug(
      `\nStand is delivering ${totalPickups} books to ${usersWithPickups} customers, distributed as follows:`,
    );
    for (const [item, count] of pickupCounts
      .entries()
      .toArray()
      .sort((a, b) => b[1] - a[1])) {
      logger.debug(`${item}: ${count}`);
    }
    const standInAndOuts = new Set<string>();
    for (const handoffCountKey of handoffCounts.keys()) {
      if (pickupCounts.has(handoffCountKey)) {
        standInAndOuts.add(handoffCountKey);
      }
    }
    for (const pickupsCountKey of pickupCounts.keys()) {
      if (handoffCounts.has(pickupsCountKey)) {
        standInAndOuts.add(pickupsCountKey);
      }
    }
    logger.debug(
      `\n${standInAndOuts.size} books are both being picked up and delivered to the stand`,
    );
    for (const standInAndOut of standInAndOuts) {
      logger.debug(
        `${standInAndOut}: ${pickupCounts.get(standInAndOut)} pickups and ${handoffCounts.get(standInAndOut)} deliveries`,
      );
    }
  }
}
