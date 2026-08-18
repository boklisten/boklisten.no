import { test } from "@japa/runner";

import { matchRoundCreateValidator } from "#validators/matches";

/**
 * Pins the formats the admin plan form sends.
 *
 * Every date is a plain `YYYY-MM-DD` string rather than a vine date: the plan describes calendar
 * days, and letting an instant through here is what would reintroduce the timezone drift the
 * deadline padding exists to absorb. The form is the only caller, so this is the contract between
 * the two.
 */
const base = {
  name: "Ullern Vår 2026",
  branches: ["5d765db5fc8c47001c408b01"],
  standLocation: "Kantina",
  deadline: "2026-07-01",
  meetingDate: "2026-06-01",
  userMeetingFrom: "12:00",
  userMeetingTo: "14:00",
  standFrom: "12:00",
  standTo: "16:00",
  userMatchLocations: ["Biblioteket"],
  includeCustomerItemsFromOtherBranches: false,
  excludedCustomerIds: [],
};

async function rejection(payload: object): Promise<Error | null> {
  return matchRoundCreateValidator.validate(payload).then(
    () => null,
    (error: Error) => error,
  );
}

test.group("matchRoundCreateValidator", () => {
  test("accepts the formats the form sends", async ({ assert }) => {
    const result = await matchRoundCreateValidator.validate(base);

    assert.equal(result.deadline, "2026-07-01");
    assert.equal(result.meetingDate, "2026-06-01");
    assert.equal(result.userMeetingFrom, "12:00");
    assert.equal(result.standTo, "16:00");
    assert.deepEqual(result.userMatchLocations, ["Biblioteket"]);
  });

  test("keeps the excluded customer list, empty or not", async ({ assert }) => {
    const excluded = await matchRoundCreateValidator.validate({
      ...base,
      excludedCustomerIds: ["5d765db5fc8c47001c408d81"],
    });
    assert.deepEqual(excluded.excludedCustomerIds, ["5d765db5fc8c47001c408d81"]);

    const nobody = await matchRoundCreateValidator.validate({
      ...base,
      excludedCustomerIds: [],
    });
    assert.deepEqual(nobody.excludedCustomerIds, []);
  });

  test("rejects an ISO timestamp deadline", async ({ assert }) => {
    // A deadline is a calendar day. Accepting an instant would let the caller's zone decide which
    // day it meant.
    assert.isNotNull(await rejection({ ...base, deadline: "2026-07-01T00:00:00.000Z" }));
  });

  test("rejects a meeting date with a time attached", async ({ assert }) => {
    assert.isNotNull(await rejection({ ...base, meetingDate: "2026-06-01T12:00:00.000Z" }));
  });

  test("rejects a time off the ten-minute grid", async ({ assert }) => {
    assert.isNotNull(await rejection({ ...base, standFrom: "12:05" }));
  });

  test("rejects an empty location list", async ({ assert }) => {
    assert.isNotNull(await rejection({ ...base, userMatchLocations: [] }));
  });

  test("rejects a round with no branches", async ({ assert }) => {
    // The old generate endpoint let this through and relied on the form to catch it.
    assert.isNotNull(await rejection({ ...base, branches: [] }));
  });

  test("rejects a date that does not exist", async ({ assert }) => {
    // `Date.parse` quietly rolls the 30th of February into March; the validator must not.
    assert.isNotNull(await rejection({ ...base, deadline: "2026-02-30" }));
  });

  test("rejects a window that ends before it starts", async ({ assert }) => {
    assert.isNotNull(
      await rejection({ ...base, userMeetingFrom: "14:00", userMeetingTo: "12:00" }),
    );
    assert.isNotNull(await rejection({ ...base, standFrom: "16:00", standTo: "12:00" }));
  });

  test("rejects a window with no length", async ({ assert }) => {
    assert.isNotNull(
      await rejection({ ...base, userMeetingFrom: "12:00", userMeetingTo: "12:00" }),
    );
  });
});
