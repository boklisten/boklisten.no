import { DateTime } from "luxon";
import { ObjectId } from "mongodb";

import MatchRound from "#models/match_round";
import { MatchFinder } from "#services/match_helpers/match-finder/match-finder";
import { MatchableUser } from "#services/match_helpers/match-finder/match-types";
import {
  buildSlots,
  scheduleMatches,
} from "#services/match_helpers/match-scheduler/match-scheduler";
import {
  MatchRepository,
  type MatchDraft,
  type ObligationDraft,
} from "#services/matches/match_repository";
import { getHeldItems, getWantedItems } from "#services/matches/round_scope";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { canonicalItemId } from "#shared/item-equivalence";
import type { UserDetail } from "#shared/user-detail";

async function getGroupMemberships(customerIds: string[]): Promise<Map<string, string>> {
  if (customerIds.length === 0) return new Map();
  const userDetails = (await StorageService.UserDetails.aggregate([
    { $match: { _id: { $in: customerIds.map((id) => new ObjectId(id)) } } },
  ])) as UserDetail[];
  return new Map(
    userDetails.flatMap((detail) =>
      detail.branchMembership ? [[detail.id, detail.branchMembership] as const] : [],
    ),
  );
}

function toMatchableUsers(
  heldByCustomer: Map<string, Set<string>>,
  wantedByCustomer: Map<string, Set<string>>,
  groupMemberships: Map<string, string>,
): MatchableUser[] {
  const customerIds = new Set([...heldByCustomer.keys(), ...wantedByCustomer.keys()]);
  return [...customerIds].map((id) => ({
    id,
    items: heldByCustomer.get(id) ?? new Set(),
    wantedItems: wantedByCustomer.get(id) ?? new Set(),
    groupMembership: groupMemberships.get(id) ?? "unknown",
  }));
}

/**
 * Collapses each customer's item set to the equivalence groups' canonical ids, so the finder pairs
 * a student holding one edition with a student who ordered another. The actual edition each
 * canonical id stood in for is remembered per customer, letting the drafts name the real book.
 */
function canonicalizeItems(byCustomer: Map<string, Set<string>>): {
  canonicalByCustomer: Map<string, Set<string>>;
  actualByCustomer: Map<string, Map<string, string>>;
} {
  const canonicalByCustomer = new Map<string, Set<string>>();
  const actualByCustomer = new Map<string, Map<string, string>>();
  for (const [customerId, itemIds] of byCustomer) {
    const canonicalIds = new Set<string>();
    const actualByCanonical = new Map<string, string>();
    for (const itemId of itemIds) {
      const canonicalId = canonicalItemId(itemId);
      canonicalIds.add(canonicalId);
      if (!actualByCanonical.has(canonicalId)) {
        actualByCanonical.set(canonicalId, itemId);
      }
    }
    canonicalByCustomer.set(customerId, canonicalIds);
    actualByCustomer.set(customerId, actualByCanonical);
  }
  return { canonicalByCustomer, actualByCustomer };
}

function obligation(
  senderCustomerId: string | null,
  receiverCustomerId: string | null,
  itemId: string,
  lockedToMatch: boolean,
): ObligationDraft {
  return { senderCustomerId, receiverCustomerId, itemId, lockedToMatch };
}

export async function generateRound(round: MatchRound) {
  const {
    id,
    standLocation,
    branches,
    deadline,
    includeCustomerItemsFromOtherBranches,
    meetingDate,
    userMatchLocations,
    excludedCustomerIds,
  } = round;

  if (deadline.startOf("day") < DateTime.now().startOf("day")) {
    throw new BlError("Fristen for runden har allerede passert").code(200);
  }

  const meetingDay = meetingDate.toISODate()!;
  const userSlots = buildSlots(meetingDay, {
    from: round.userMeetingFrom,
    to: round.userMeetingTo,
  });
  const standSlots = buildSlots(meetingDay, { from: round.standFrom, to: round.standTo });
  if (userSlots.length === 0) {
    throw new BlError("Elevenes møtevindu må vare i minst ti minutter").code(200);
  }
  if (standSlots.length === 0) {
    throw new BlError("Standens åpningstid må vare i minst ti minutter").code(200);
  }

  const [heldByCustomer, wantedByCustomer] = await Promise.all([
    getHeldItems(branches, deadline, includeCustomerItemsFromOtherBranches),
    getWantedItems(branches),
  ]);

  for (const excludedId of excludedCustomerIds) {
    heldByCustomer.delete(excludedId);
    wantedByCustomer.delete(excludedId);
  }

  const groupMemberships = await getGroupMemberships([
    ...new Set([...heldByCustomer.keys(), ...wantedByCustomer.keys()]),
  ]);
  const held = canonicalizeItems(heldByCustomer);
  const wanted = canonicalizeItems(wantedByCustomer);
  // The obligations name the physical book: the edition the sender holds for handovers to a
  // student or the stand, and the edition the receiver ordered for pure stand pickups.
  const heldEdition = (customerId: string, itemId: string) =>
    held.actualByCustomer.get(customerId)?.get(itemId) ?? itemId;
  const wantedEdition = (customerId: string, itemId: string) =>
    wanted.actualByCustomer.get(customerId)?.get(itemId) ?? itemId;
  const matchableUsers = toMatchableUsers(
    held.canonicalByCustomer,
    wanted.canonicalByCustomer,
    groupMemberships,
  );
  if (matchableUsers.length === 0) {
    throw new BlError("Fant ingen elever å lage overleveringer for").code(200);
  }

  const [candidateUserMatches, candidateStandMatches] = new MatchFinder(
    matchableUsers,
  ).generateMatches();

  if (candidateUserMatches.length === 0 && candidateStandMatches.length === 0) {
    throw new BlError("Fant ingen overleveringer å lage").code(200);
  }

  const { userMatchAssignments, standMatchTimes } = scheduleMatches({
    userMatches: candidateUserMatches,
    standMatches: candidateStandMatches,
    memberships: groupMemberships,
    userSlots,
    standSlots,
    locations: userMatchLocations,
  });

  const drafts: MatchDraft[] = [
    ...candidateUserMatches.map((candidate, index): MatchDraft => {
      const { customerA, customerB } = candidate;
      const assignment = userMatchAssignments[index]!;
      return {
        meetingLocation: assignment.location,
        meetingTime: assignment.time,
        participantCustomerIds: [customerA, customerB],
        obligations: [
          ...[...candidate.expectedAToBItems].map((itemId) =>
            obligation(customerA, customerB, heldEdition(customerA, itemId), true),
          ),
          ...[...candidate.expectedBToAItems].map((itemId) =>
            obligation(customerB, customerA, heldEdition(customerB, itemId), true),
          ),
        ],
      };
    }),
    ...candidateStandMatches.map((candidate, index): MatchDraft => {
      const { customer } = candidate;
      return {
        meetingLocation: standLocation,
        meetingTime: standMatchTimes[index]!,
        participantCustomerIds: [customer, null],
        obligations: [
          ...[...candidate.expectedHandoffItems].map((itemId) =>
            obligation(customer, null, heldEdition(customer, itemId), false),
          ),
          ...[...candidate.expectedPickupItems].map((itemId) =>
            obligation(null, customer, wantedEdition(customer, itemId), false),
          ),
        ],
      };
    }),
  ];

  const generated = await MatchRepository.attachMatches(id, drafts);

  return {
    roundId: String(generated.id),
    userMatchCount: candidateUserMatches.length,
    standMatchCount: candidateStandMatches.length,
  };
}
