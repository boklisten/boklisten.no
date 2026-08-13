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

  const groupMemberships = await getGroupMemberships([
    ...new Set([...heldByCustomer.keys(), ...wantedByCustomer.keys()]),
  ]);
  const matchableUsers = toMatchableUsers(heldByCustomer, wantedByCustomer, groupMemberships);
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
            obligation(customerA, customerB, itemId, true),
          ),
          ...[...candidate.expectedBToAItems].map((itemId) =>
            obligation(customerB, customerA, itemId, true),
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
            obligation(customer, null, itemId, false),
          ),
          ...[...candidate.expectedPickupItems].map((itemId) =>
            obligation(null, customer, itemId, false),
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
