import { test } from "@japa/runner";

import { matchGenerateValidator } from "#validators/matches";

/**
 * Pins the formats the admin generate form sends.
 *
 * `vine.date()` parses a fixed list of formats, so a payload that looks obviously fine — an ISO
 * timestamp straight out of `Date.toISOString()` — can still be rejected. The meeting date and
 * times are therefore plain regex-validated strings; only `deadlineBefore` stays a vine date.
 * The form is the only caller, so this is the contract between the two.
 */
const base = {
  name: "Ullern Vår 2026",
  branches: ["5d765db5fc8c47001c408b01"],
  standLocation: "Kantina",
  meetingDate: "2026-06-01",
  userMeetingWindow: { from: "12:00", to: "14:00" },
  standWindow: { from: "12:00", to: "16:00" },
  userMatchLocations: ["Biblioteket"],
  deadlineBefore: "2026-07-01",
  includeCustomerItemsFromOtherBranches: false,
};

async function rejection(payload: object): Promise<Error | null> {
  return matchGenerateValidator.validate(payload).then(
    () => null,
    (error: Error) => error,
  );
}

test.group("matchGenerateValidator", () => {
  test("accepts the formats the form sends", async ({ assert }) => {
    const result = await matchGenerateValidator.validate(base);

    assert.instanceOf(result.deadlineBefore, Date);
    assert.equal(result.meetingDate, "2026-06-01");
    assert.deepEqual(result.userMeetingWindow, { from: "12:00", to: "14:00" });
    assert.deepEqual(result.standWindow, { from: "12:00", to: "16:00" });
    assert.deepEqual(result.userMatchLocations, ["Biblioteket"]);
  });

  test("rejects an ISO timestamp deadline", async ({ assert }) => {
    // `Date.toISOString()` output is *not* accepted, which is why the form formats explicitly
    // rather than passing whatever the date picker hands it.
    assert.isNotNull(await rejection({ ...base, deadlineBefore: "2026-07-01T00:00:00.000Z" }));
  });

  test("rejects a meeting date with a time attached", async ({ assert }) => {
    assert.isNotNull(await rejection({ ...base, meetingDate: "2026-06-01T12:00:00.000Z" }));
  });

  test("rejects a time off the ten-minute grid", async ({ assert }) => {
    assert.isNotNull(await rejection({ ...base, standWindow: { from: "12:05", to: "14:00" } }));
  });

  test("rejects an empty location list", async ({ assert }) => {
    assert.isNotNull(await rejection({ ...base, userMatchLocations: [] }));
  });
});
