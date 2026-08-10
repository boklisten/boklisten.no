import { Infer } from "@vinejs/vine/types";
import { DateTime } from "luxon";
import { ObjectId } from "mongodb";

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
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { UserDetail } from "#shared/user-detail";
import { matchGenerateSchema } from "#validators/matches";

async function getHeldItems(
  branchIds: string[],
  deadlineBefore: Date,
  includeItemsFromOtherBranches: boolean,
): Promise<Map<string, Set<string>>> {
  const groupByCustomer = {
    $group: {
      _id: "$customer",
      id: { $first: "$customer" },
      items: { $addToSet: "$item" },
    },
  };

  const baseMatch = {
    returned: false,
    buyout: false,
    cancel: false,
    buyback: false,
    deadline: { $gt: new Date(), $lte: deadlineBefore },
  };

  let aggregated = (await StorageService.CustomerItems.aggregate([
    {
      $match: {
        ...baseMatch,
        "handoutInfo.handoutBy": "branch",
        "handoutInfo.handoutById": { $in: branchIds.map((id) => new ObjectId(id)) },
      },
    },
    groupByCustomer,
  ])) as { id: string; items: string[] }[];

  if (includeItemsFromOtherBranches) {
    aggregated = (await StorageService.CustomerItems.aggregate([
      {
        $match: {
          ...baseMatch,
          customer: { $in: aggregated.map((sender) => new ObjectId(sender.id)) },
        },
      },
      groupByCustomer,
    ])) as { id: string; items: string[] }[];
  }

  return new Map(
    aggregated.map((sender) => [String(sender.id), new Set(sender.items.map(String))]),
  );
}

async function getWantedItems(branchIds: string[]): Promise<Map<string, Set<string>>> {
  const aggregated = (await StorageService.Orders.aggregate([
    {
      $match: {
        placed: true,
        byCustomer: true,
        handoutByDelivery: { $ne: true },
        branch: { $in: branchIds.map((id) => new ObjectId(id)) },
      },
    },
    {
      $addFields: {
        orderItems: {
          $filter: {
            input: "$orderItems",
            as: "orderItem",
            cond: {
              $and: [
                { $not: "$$orderItem.handout" },
                { $not: "$$orderItem.movedToOrder" },
                { $in: ["$$orderItem.type", ["rent", "partly-payment"]] },
              ],
            },
          },
        },
      },
    },
    { $match: { $expr: { $gt: [{ $size: "$orderItems" }, 0] } } },
    { $unwind: "$orderItems" },
    {
      $group: {
        _id: "$customer",
        id: { $first: "$customer" },
        wantedItems: { $addToSet: "$orderItems.item" },
      },
    },
  ])) as { id: string; wantedItems: string[] }[];

  return new Map(
    aggregated.map((receiver) => [String(receiver.id), new Set(receiver.wantedItems.map(String))]),
  );
}

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

export async function generateRound({
  name,
  standLocation,
  branches,
  deadlineBefore,
  includeCustomerItemsFromOtherBranches,
  meetingDate,
  userMeetingWindow,
  standWindow,
  userMatchLocations,
}: Infer<typeof matchGenerateSchema>) {
  const userSlots = buildSlots(meetingDate, userMeetingWindow);
  const standSlots = buildSlots(meetingDate, standWindow);
  if (userSlots.length === 0) {
    throw new BlError("Elevenes møtevindu må vare i minst ti minutter").code(200);
  }
  if (standSlots.length === 0) {
    throw new BlError("Standens åpningstid må vare i minst ti minutter").code(200);
  }

  const paddedDeadline = DateTime.fromJSDate(deadlineBefore).plus({ days: 2 }).toJSDate();

  const [heldByCustomer, wantedByCustomer] = await Promise.all([
    getHeldItems(branches, paddedDeadline, includeCustomerItemsFromOtherBranches),
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

  const round = await MatchRepository.createRound(
    { name, standLocation, generatedAt: DateTime.now() },
    drafts,
  );

  return {
    roundId: String(round.id),
    userMatchCount: candidateUserMatches.length,
    standMatchCount: candidateStandMatches.length,
  };
}
