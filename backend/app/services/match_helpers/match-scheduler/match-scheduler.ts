import { DateTime } from "luxon";

import { BlError } from "#shared/bl-error";
import type { CandidateUserMatch } from "#services/match_helpers/match-finder/match-types";
import type {
  ScheduleInput,
  ScheduleResult,
  UserMatchAssignment,
} from "#services/match_helpers/match-scheduler/scheduler-types";

/**
 * The ten-minute ticks of a window on the given day, half-open: 12:00–14:00 yields 12:00 … 13:50.
 * Times are wall-clock Europe/Oslo, never server-local — meeting times must not drift when the
 * backend runs in UTC.
 */
export function buildSlots(date: string, window: { from: string; to: string }): DateTime[] {
  const start = DateTime.fromISO(`${date}T${window.from}`, { zone: "Europe/Oslo" });
  const end = DateTime.fromISO(`${date}T${window.to}`, { zone: "Europe/Oslo" });
  const slots: DateTime[] = [];
  for (let slot = start; slot < end; slot = slot.plus({ minutes: 10 })) {
    slots.push(slot);
  }
  return slots;
}

/**
 * Candidate cells are compared lexicographically, so a lower-priority goal can never accumulate
 * past a higher one: location stickiness, then compactness of each person's day, then even
 * spread, then the class-cohort tiebreak, then earliest slot and first location for determinism.
 */
type Score = readonly [
  stickiness: number,
  compactness: number,
  spread: number,
  cohort: number,
  slotOrder: number,
  locationOrder: number,
];

function beats(candidate: Score, incumbent: Score): boolean {
  for (let index = 0; index < candidate.length; index++) {
    if (candidate[index] !== incumbent[index]) return candidate[index]! > incumbent[index]!;
  }
  return false;
}

interface SchedulerState {
  /** person → (slot index → location index) they are committed to. */
  occupancy: Map<string, Map<number, number>>;
  /** person → location indices any of their meetings use. */
  usedLocations: Map<string, Set<number>>;
  /** Distinct people present per slot. */
  peopleInSlot: number[];
  /** Distinct people present per (slot, location). */
  peopleInCell: number[][];
  /** Branch-membership pair keys present per slot, for the cohort tiebreak. */
  cohortPairs: Set<string>[];
}

function scoreCell(
  participants: readonly [string, string],
  slot: number,
  location: number,
  cohortKey: string,
  state: SchedulerState,
): Score {
  let stickiness = 0;
  let compactness = 0;
  for (const person of participants) {
    if (state.usedLocations.get(person)?.has(location)) stickiness++;
    const occupied = state.occupancy.get(person);
    if (occupied !== undefined && occupied.size > 0) {
      if (occupied.has(slot)) {
        // Joining a sitting they already hold (necessarily at this location) is co-scheduling —
        // the best compactness there is.
        compactness += 1000;
      } else {
        let nearest = Number.MAX_SAFE_INTEGER;
        for (const theirSlot of occupied.keys()) {
          nearest = Math.min(nearest, Math.abs(theirSlot - slot));
        }
        compactness += Math.max(0, 100 - nearest);
      }
    }
  }
  const spread = -(2 * state.peopleInCell[slot]![location]! + state.peopleInSlot[slot]!);
  const cohort = state.cohortPairs[slot]!.has(cohortKey) ? 1 : 0;
  return [stickiness, compactness, spread, cohort, -slot, -location];
}

function findBestCell(
  participants: readonly [string, string],
  cohortKey: string,
  state: SchedulerState,
  input: ScheduleInput,
): { slot: number; location: number } | null {
  let best: { slot: number; location: number; score: Score } | null = null;
  for (let slot = 0; slot < input.userSlots.length; slot++) {
    for (let location = 0; location < input.locations.length; location++) {
      // A participant already placed in this slot must be at exactly this location.
      const blocked = participants.some((person) => {
        const at = state.occupancy.get(person)?.get(slot);
        return at !== undefined && at !== location;
      });
      if (blocked) continue;
      const score = scoreCell(participants, slot, location, cohortKey, state);
      if (best === null || beats(score, best.score)) {
        best = { slot, location, score };
      }
    }
  }
  return best === null ? null : { slot: best.slot, location: best.location };
}

function commit(
  participants: readonly [string, string],
  slot: number,
  location: number,
  cohortKey: string,
  state: SchedulerState,
) {
  for (const person of participants) {
    let occupied = state.occupancy.get(person);
    if (occupied === undefined) {
      occupied = new Map();
      state.occupancy.set(person, occupied);
    }
    if (!occupied.has(slot)) {
      occupied.set(slot, location);
      state.peopleInSlot[slot]!++;
      state.peopleInCell[slot]![location]!++;
    }
    let used = state.usedLocations.get(person);
    if (used === undefined) {
      used = new Set();
      state.usedLocations.set(person, used);
    }
    used.add(location);
  }
  state.cohortPairs[slot]!.add(cohortKey);
}

/**
 * Greedy assignment of one (slot, location) per user match, most-constrained people first.
 * Deterministic: every iteration order is fixed by match counts and ids, so the same input
 * always yields the same schedule.
 */
export function scheduleUserMeetings(input: ScheduleInput): UserMatchAssignment[] {
  const { userMatches, userSlots, locations, memberships } = input;
  if (userMatches.length === 0) return [];

  const state: SchedulerState = {
    occupancy: new Map(),
    usedLocations: new Map(),
    peopleInSlot: userSlots.map(() => 0),
    peopleInCell: userSlots.map(() => locations.map(() => 0)),
    cohortPairs: userSlots.map(() => new Set()),
  };

  const matchCounts = new Map<string, number>();
  for (const match of userMatches) {
    for (const person of [match.customerA, match.customerB]) {
      matchCounts.set(person, (matchCounts.get(person) ?? 0) + 1);
    }
  }
  const people = [...matchCounts.keys()].toSorted((a, b) => {
    const byCount = matchCounts.get(b)! - matchCounts.get(a)!;
    return byCount !== 0 ? byCount : a.localeCompare(b);
  });

  const cohortKey = (match: CandidateUserMatch) =>
    [memberships.get(match.customerA) ?? "unknown", memberships.get(match.customerB) ?? "unknown"]
      .toSorted((a, b) => a.localeCompare(b))
      .join("|");

  const assignments: (UserMatchAssignment | null)[] = Array.from(
    { length: userMatches.length },
    () => null,
  );
  for (const person of people) {
    const pending = userMatches
      .map((match, index) => ({ match, index }))
      .filter(
        ({ match, index }) =>
          assignments[index] === null && (match.customerA === person || match.customerB === person),
      )
      .toSorted((a, b) => {
        const counterpartyOf = (entry: { match: CandidateUserMatch }) =>
          entry.match.customerA === person ? entry.match.customerB : entry.match.customerA;
        const byCounterparty = counterpartyOf(a).localeCompare(counterpartyOf(b));
        return byCounterparty !== 0 ? byCounterparty : a.index - b.index;
      });

    for (const { match, index } of pending) {
      const participants = [match.customerA, match.customerB] as const;
      const key = cohortKey(match);
      const best = findBestCell(participants, key, state, input);
      if (best === null) {
        throw new BlError(
          "Møtevinduet er for kort til å få plass til alle møtene — utvid vinduet eller legg til flere møtesteder",
        ).code(200);
      }
      commit(participants, best.slot, best.location, key, state);
      assignments[index] = {
        time: userSlots[best.slot]!,
        location: locations[best.location]!,
      };
    }
  }
  return assignments.map((assignment) => {
    if (assignment === null) throw new BlError("Ikke alle møter fikk tildelt et tidspunkt");
    return assignment;
  });
}

/**
 * Fills the stand's window slot by slot to an even target, taking visitors from a queue sorted
 * by need-profile signature so students delivering the same titles arrive together. A visitor is
 * eligible only after their last user meeting; when the stand closes before their meetings end
 * they bend to the last slot rather than fail. The final slot's target equals everyone left, so
 * every stand match always gets a time.
 */
export function scheduleStandVisits(
  input: ScheduleInput,
  userAssignments: UserMatchAssignment[],
): DateTime[] {
  const { standMatches, standSlots, userMatches } = input;
  if (standMatches.length === 0) return [];
  if (standSlots.length === 0) {
    throw new BlError("Standens åpningstid må vare i minst ti minutter").code(200);
  }

  const lastMeeting = new Map<string, DateTime>();
  userMatches.forEach((match, index) => {
    const time = userAssignments[index]!.time;
    for (const person of [match.customerA, match.customerB]) {
      const previous = lastMeeting.get(person);
      if (previous === undefined || time > previous) lastMeeting.set(person, time);
    }
  });

  const eligibleFrom = standMatches.map((standMatch) => {
    const last = lastMeeting.get(standMatch.customer);
    if (last === undefined) return 0;
    const index = standSlots.findIndex((slot) => slot > last);
    return index === -1 ? standSlots.length - 1 : index;
  });

  let queue = standMatches
    .map((standMatch, index) => ({
      index,
      signature: [...standMatch.expectedHandoffItems, ...standMatch.expectedPickupItems]
        .toSorted((a, b) => a.localeCompare(b))
        .join(","),
    }))
    .toSorted(
      (a, b) =>
        a.signature.localeCompare(b.signature) ||
        standMatches[a.index]!.customer.localeCompare(standMatches[b.index]!.customer),
    );

  const times: DateTime[] = Array.from({ length: standMatches.length });
  for (let slot = 0; slot < standSlots.length && queue.length > 0; slot++) {
    const target = Math.ceil(queue.length / (standSlots.length - slot));
    const deferred: typeof queue = [];
    let taken = 0;
    for (const visitor of queue) {
      if (taken < target && eligibleFrom[visitor.index]! <= slot) {
        times[visitor.index] = standSlots[slot]!;
        taken++;
      } else {
        deferred.push(visitor);
      }
    }
    queue = deferred;
  }
  return times;
}

/** The scheduler's single entry point: user meetings first, then stand visits after them. */
export function scheduleMatches(input: ScheduleInput): ScheduleResult {
  const userMatchAssignments = scheduleUserMeetings(input);
  const standMatchTimes = scheduleStandVisits(input, userMatchAssignments);
  return { userMatchAssignments, standMatchTimes };
}
