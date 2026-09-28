import { DateTime } from "luxon";

import type MatchRound from "#models/match_round";
import User from "#models/user";
import { MatchFinder } from "#services/match_helpers/match-finder/match-finder";
import type {
  CandidateStandMatch,
  MatchableUser,
} from "#services/match_helpers/match-finder/match-types";
import {
  buildSlots,
  scheduleMatches,
} from "#services/match_helpers/match-scheduler/match-scheduler";
import { MatchRepository } from "#services/matches/match_repository";
import type { MatchDraft, ObligationDraft } from "#services/matches/match_repository";
import { getRoundBooks, resolveRoundScope } from "#services/matches/round_scope";
import type { BooksByCustomer } from "#services/matches/round_scope";
import { BlError } from "#shared/bl-error";
import { canonicalItemId } from "#shared/item-equivalence";

async function getGroupMemberships(customerIds: string[]): Promise<Map<string, string>> {
  if (customerIds.length === 0) {
    return new Map();
  }
  const users = await User.byIds(customerIds);
  return new Map(
    [...users.values()].flatMap((user) =>
      user.branchMembershipId ? [[user.id, user.branchMembershipId] as const] : [],
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
): ObligationDraft {
  return { senderCustomerId, receiverCustomerId, itemId };
}

/**
 * Joins the finder's stand visits with the books that go via the stand regardless, into one visit
 * per customer. Items are the physical editions, not the canonical ids the finder works with.
 */
function standVisits(
  finderMatches: CandidateStandMatch[],
  toActual: Record<"handoff" | "pickup", (customerId: string, itemId: string) => string>,
  standOnly: { held: BooksByCustomer; wanted: BooksByCustomer },
): CandidateStandMatch[] {
  const visits = new Map<string, CandidateStandMatch>();
  const visit = (customer: string) => {
    const existing = visits.get(customer);
    if (existing) {
      return existing;
    }
    const created = {
      customer,
      expectedHandoffItems: new Set<string>(),
      expectedPickupItems: new Set<string>(),
    };
    visits.set(customer, created);
    return created;
  };
  for (const { customer, expectedHandoffItems, expectedPickupItems } of finderMatches) {
    for (const itemId of expectedHandoffItems) {
      visit(customer).expectedHandoffItems.add(toActual.handoff(customer, itemId));
    }
    for (const itemId of expectedPickupItems) {
      visit(customer).expectedPickupItems.add(toActual.pickup(customer, itemId));
    }
  }
  for (const [customer, items] of standOnly.held) {
    for (const itemId of items) {
      visit(customer).expectedHandoffItems.add(itemId);
    }
  }
  for (const [customer, items] of standOnly.wanted) {
    for (const itemId of items) {
      visit(customer).expectedPickupItems.add(itemId);
    }
  }
  return [...visits.values()];
}

export async function generateRound(round: MatchRound) {
  const { id, standLocation, deadline, meetingDate, userMatchLocations } = round;

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

  const { held: heldBooks, wanted: wantedBooks } = await getRoundBooks(
    round,
    await resolveRoundScope(round),
  );

  const groupMemberships = await getGroupMemberships([
    ...new Set([
      ...heldBooks.matchable.keys(),
      ...wantedBooks.matchable.keys(),
      ...heldBooks.standOnly.keys(),
      ...wantedBooks.standOnly.keys(),
    ]),
  ]);
  const held = canonicalizeItems(heldBooks.matchable);
  const wanted = canonicalizeItems(wantedBooks.matchable);
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
  if (
    matchableUsers.length === 0 &&
    heldBooks.standOnly.size === 0 &&
    wantedBooks.standOnly.size === 0
  ) {
    throw new BlError("Fant ingen elever å lage overleveringer for").code(200);
  }

  const [candidateUserMatches, finderStandMatches] =
    matchableUsers.length === 0 ? [[], []] : new MatchFinder(matchableUsers).generateMatches();
  const candidateStandMatches = standVisits(
    finderStandMatches,
    { handoff: heldEdition, pickup: wantedEdition },
    { held: heldBooks.standOnly, wanted: wantedBooks.standOnly },
  );

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
            obligation(customerA, customerB, heldEdition(customerA, itemId)),
          ),
          ...[...candidate.expectedBToAItems].map((itemId) =>
            obligation(customerB, customerA, heldEdition(customerB, itemId)),
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
            obligation(customer, null, itemId),
          ),
          ...[...candidate.expectedPickupItems].map((itemId) => obligation(null, customer, itemId)),
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
