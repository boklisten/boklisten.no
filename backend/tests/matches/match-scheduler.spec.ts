import { test } from "@japa/runner";
import { DateTime } from "luxon";

import {
  buildSlots,
  scheduleMatches,
  scheduleUserMeetings,
} from "#services/match_helpers/match-scheduler/match-scheduler";
import type {
  ScheduleInput,
  UserMatchAssignment,
} from "#services/match_helpers/match-scheduler/scheduler-types";
import type {
  CandidateStandMatch,
  CandidateUserMatch,
} from "#services/match_helpers/match-finder/match-types";

const DATE = "2026-06-01";

function slots(from: string, to: string) {
  return buildSlots(DATE, { from, to });
}

function userMatch(a: string, b: string, aToB: string[] = ["item-1"]): CandidateUserMatch {
  return {
    customerA: a,
    customerB: b,
    expectedAToBItems: new Set(aToB),
    expectedBToAItems: new Set(),
  };
}

function input(overrides: Partial<ScheduleInput>): ScheduleInput {
  return {
    userMatches: [],
    standMatches: [],
    memberships: new Map(),
    userSlots: slots("12:00", "14:00"),
    standSlots: slots("12:00", "16:00"),
    locations: ["X"],
    ...overrides,
  };
}

/** Hard-rule invariants every schedule must satisfy, checked in most tests below. */
function assertUserInvariants(
  assert: { isTrue: (v: boolean, msg?: string) => void },
  scheduleInput: ScheduleInput,
  assignments: UserMatchAssignment[],
) {
  const slotTimes = new Set(scheduleInput.userSlots.map((slot) => slot.toMillis()));
  const personPlacement = new Map<string, string>();
  scheduleInput.userMatches.forEach((match, index) => {
    const assignment = assignments[index]!;
    assert.isTrue(slotTimes.has(assignment.time.toMillis()), "meeting must be on a window slot");
    assert.isTrue(scheduleInput.locations.includes(assignment.location));
    for (const person of [match.customerA, match.customerB]) {
      const key = `${person}@${assignment.time.toMillis()}`;
      const existing = personPlacement.get(key);
      assert.isTrue(
        existing === undefined || existing === assignment.location,
        `${person} must not be in two locations in one slot`,
      );
      personPlacement.set(key, assignment.location);
    }
  });
}

test.group("buildSlots", () => {
  test("yields ten-minute ticks, half-open, in Europe/Oslo", ({ assert }) => {
    const built = buildSlots(DATE, { from: "12:00", to: "14:00" });

    assert.lengthOf(built, 12);
    assert.equal(built[0]!.toISO(), "2026-06-01T12:00:00.000+02:00");
    assert.equal(built[11]!.toISO(), "2026-06-01T13:50:00.000+02:00");
    // CEST in June: 12:00 Oslo is 10:00 UTC — never the server's local time.
    assert.equal(built[0]!.toUTC().hour, 10);
  });

  test("yields nothing when the window is empty or reversed", ({ assert }) => {
    assert.lengthOf(buildSlots(DATE, { from: "12:00", to: "12:00" }), 0);
    assert.lengthOf(buildSlots(DATE, { from: "14:00", to: "12:00" }), 0);
  });
});

test.group("scheduleUserMeetings", () => {
  test("both participants share a slot and a location", ({ assert }) => {
    const scheduleInput = input({ userMatches: [userMatch("anna", "bo")] });

    const assignments = scheduleUserMeetings(scheduleInput);

    assert.lengthOf(assignments, 1);
    assertUserInvariants(assert, scheduleInput, assignments);
  });

  test("a person's several matches are co-scheduled into one sitting", ({ assert }) => {
    const scheduleInput = input({
      userMatches: [userMatch("anna", "bo"), userMatch("anna", "cato")],
      locations: ["X", "Y"],
    });

    const assignments = scheduleUserMeetings(scheduleInput);

    assertUserInvariants(assert, scheduleInput, assignments);
    assert.equal(assignments[0]!.time.toMillis(), assignments[1]!.time.toMillis());
    assert.equal(assignments[0]!.location, assignments[1]!.location);
  });

  test("a connected group stays at one location", ({ assert }) => {
    // A chain with chords: everyone is transitively linked, so location stickiness
    // must keep the whole component at a single location even across slots.
    const scheduleInput = input({
      userMatches: [
        userMatch("p1", "p2"),
        userMatch("p2", "p3"),
        userMatch("p3", "p4"),
        userMatch("p4", "p5"),
        userMatch("p1", "p3"),
        userMatch("p2", "p4"),
      ],
      locations: ["X", "Y"],
    });

    const assignments = scheduleUserMeetings(scheduleInput);

    assertUserInvariants(assert, scheduleInput, assignments);
    const perPerson = new Map<string, Set<string>>();
    scheduleInput.userMatches.forEach((match, index) => {
      for (const person of [match.customerA, match.customerB]) {
        const used = perPerson.get(person) ?? new Set();
        used.add(assignments[index]!.location);
        perPerson.set(person, used);
      }
    });
    for (const [person, locations] of perPerson) {
      assert.equal(locations.size, 1, `${person} should meet at a single location`);
    }
  });

  test("independent pairs spread out over slots and locations", ({ assert }) => {
    const userMatches = Array.from({ length: 10 }, (_, index) =>
      userMatch(`a${index}`, `b${index}`),
    );
    const scheduleInput = input({
      userMatches,
      userSlots: slots("12:00", "12:50"), // 5 slots
      locations: ["X", "Y"],
    });

    const assignments = scheduleUserMeetings(scheduleInput);

    assertUserInvariants(assert, scheduleInput, assignments);
    // 10 unrelated pairs, 10 cells: even spread means exactly one pair per (slot, location).
    const cells = new Set(
      assignments.map((assignment) => `${assignment.time.toMillis()}@${assignment.location}`),
    );
    assert.equal(cells.size, 10);
  });

  test("same-class matches share a slot when spread is otherwise equal", ({ assert }) => {
    const scheduleInput = input({
      userMatches: [
        userMatch("a1", "a2"), // VG1 pair, lands in slot 0
        userMatch("b1", "b2"), // VG2 pair, spread pushes it to slot 1
        userMatch("c1", "c2"), // VG1 pair — spread is tied, cohort should pick slot 0
      ],
      userSlots: slots("12:00", "12:20"), // 2 slots
      locations: ["X"],
      memberships: new Map([
        ["a1", "VG1"],
        ["a2", "VG1"],
        ["b1", "VG2"],
        ["b2", "VG2"],
        ["c1", "VG1"],
        ["c2", "VG1"],
      ]),
    });

    const assignments = scheduleUserMeetings(scheduleInput);

    assertUserInvariants(assert, scheduleInput, assignments);
    assert.equal(assignments[2]!.time.toMillis(), assignments[0]!.time.toMillis());
    assert.notEqual(assignments[1]!.time.toMillis(), assignments[0]!.time.toMillis());
  });

  test("is deterministic", ({ assert }) => {
    const make = () =>
      input({
        userMatches: [
          userMatch("p1", "p2"),
          userMatch("p3", "p4"),
          userMatch("p1", "p4"),
          userMatch("p5", "p6"),
        ],
        locations: ["X", "Y"],
      });

    const first = scheduleUserMeetings(make());
    const second = scheduleUserMeetings(make());

    assert.deepEqual(
      first.map((a) => `${a.time.toISO()}@${a.location}`),
      second.map((a) => `${a.time.toISO()}@${a.location}`),
    );
  });

  test("fails in Norwegian when the window cannot hold a conflict chain", ({ assert }) => {
    // One slot, two locations. a1's trio fills (slot0, X); spread sends b1's pair to Y;
    // the b1–z9 match then needs b1 (at Y) and z9 (at X) together — impossible in one slot.
    const scheduleInput = input({
      userMatches: [
        userMatch("a1", "a2"),
        userMatch("a1", "a3"),
        userMatch("a1", "z9"),
        userMatch("b1", "b2"),
        userMatch("b1", "b3"),
        userMatch("b1", "z9"),
      ],
      userSlots: slots("12:00", "12:10"), // a single slot
      locations: ["X", "Y"],
    });

    assert.throws(() => scheduleUserMeetings(scheduleInput), /Møtevinduet er for kort/);
  });

  test("the same conflict chain fits once the window has two slots", ({ assert }) => {
    const scheduleInput = input({
      userMatches: [
        userMatch("a1", "a2"),
        userMatch("a1", "a3"),
        userMatch("a1", "z9"),
        userMatch("b1", "b2"),
        userMatch("b1", "b3"),
        userMatch("b1", "z9"),
      ],
      userSlots: slots("12:00", "12:20"),
      locations: ["X", "Y"],
    });

    const assignments = scheduleUserMeetings(scheduleInput);

    assertUserInvariants(assert, scheduleInput, assignments);
    assert.lengthOf(assignments, 6);
  });
});

function standMatch(
  customer: string,
  handoff: string[] = ["item-1"],
  pickup: string[] = [],
): CandidateStandMatch {
  return {
    customer,
    expectedHandoffItems: new Set(handoff),
    expectedPickupItems: new Set(pickup),
  };
}

test.group("scheduleMatches — stand visits", () => {
  test("spreads visitors evenly across the stand window", ({ assert }) => {
    const scheduleInput = input({
      standMatches: Array.from({ length: 6 }, (_, index) => standMatch(`v${index}`)),
      standSlots: slots("12:00", "12:30"), // 3 slots
    });

    const { standMatchTimes } = scheduleMatches(scheduleInput);

    const perSlot = new Map<number, number>();
    for (const time of standMatchTimes) {
      perSlot.set(time.toMillis(), (perSlot.get(time.toMillis()) ?? 0) + 1);
    }
    assert.deepEqual([...perSlot.values()], [2, 2, 2]);
  });

  test("a visitor's stand slot comes after their last user meeting", ({ assert }) => {
    const scheduleInput = input({
      userMatches: [userMatch("anna", "bo")],
      standMatches: [standMatch("anna")],
      userSlots: slots("12:00", "13:00"),
      standSlots: slots("12:00", "13:00"),
    });

    const { userMatchAssignments, standMatchTimes } = scheduleMatches(scheduleInput);

    assert.isTrue(standMatchTimes[0]! > userMatchAssignments[0]!.time);
  });

  test("bends to the last stand slot when the stand closes before the meetings", ({ assert }) => {
    const scheduleInput = input({
      userMatches: [userMatch("anna", "bo")],
      standMatches: [standMatch("anna")],
      userSlots: slots("12:00", "13:00"),
      standSlots: slots("09:00", "10:00"),
    });

    const { standMatchTimes } = scheduleMatches(scheduleInput);

    assert.equal(standMatchTimes[0]!.toISO(), "2026-06-01T09:50:00.000+02:00");
  });

  test("clusters similar need-profiles into the same slot", ({ assert }) => {
    const scheduleInput = input({
      standMatches: [
        standMatch("v1", ["item-r2"]),
        standMatch("v2", ["item-terra"]),
        standMatch("v3", ["item-r2"]),
        standMatch("v4", ["item-terra"]),
      ],
      standSlots: slots("12:00", "12:20"), // 2 slots
    });

    const { standMatchTimes } = scheduleMatches(scheduleInput);

    assert.equal(standMatchTimes[0]!.toMillis(), standMatchTimes[2]!.toMillis());
    assert.equal(standMatchTimes[1]!.toMillis(), standMatchTimes[3]!.toMillis());
    assert.notEqual(standMatchTimes[0]!.toMillis(), standMatchTimes[1]!.toMillis());
  });

  test("every stand match gets a time", ({ assert }) => {
    const scheduleInput = input({
      userMatches: [userMatch("anna", "bo"), userMatch("cato", "dina")],
      standMatches: [standMatch("anna"), standMatch("cato"), standMatch("eli")],
      userSlots: slots("12:00", "13:00"),
      standSlots: slots("12:00", "12:20"),
    });

    const { standMatchTimes } = scheduleMatches(scheduleInput);

    assert.lengthOf(standMatchTimes, 3);
    for (const time of standMatchTimes) {
      assert.isTrue(DateTime.isDateTime(time));
    }
  });
});
