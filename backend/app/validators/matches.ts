import vine from "@vinejs/vine";
import { DateTime } from "luxon";

import { SLOT_TIME_PATTERN } from "#shared/match/match-round-dto";

/**
 * The regex only pins the shape; `2026-02-30` fits it, and `Date.parse` quietly rolls such dates
 * into March. Luxon is the one that actually refuses a day that does not exist.
 */
const realCalendarDate = vine.createRule((value, _, field) => {
  if (typeof value !== "string") {
    return;
  }
  if (!DateTime.fromISO(value).isValid) {
    field.report(`${value} er ikke en gyldig dato`, "real_calendar_date", field);
  }
});

/**
 * Zero-padded `HH:MM` sorts as plain strings, so "ends after it starts" is a string comparison
 * against the named sibling field. Skipped when the sibling is absent, which only a hand-crafted
 * partial patch can arrange — the plan form always sends both ends of a window.
 */
const laterThan = vine.createRule((value, startField: string, field) => {
  const start: unknown = Reflect.get(new Object(field.parent), startField);
  if (typeof value !== "string" || typeof start !== "string") {
    return;
  }
  if (value <= start) {
    field.report("Sluttiden må være etter starttiden", "later_than", field);
  }
});

const slotTime = () => vine.string().regex(SLOT_TIME_PATTERN);
const calendarDate = () =>
  vine
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .use(realCalendarDate());

/**
 * The plan itself: everything a round needs before it can be generated, bar its name. Kept flat so
 * it matches the columns it is stored in one-for-one, leaving nothing to translate between the
 * request and the row.
 *
 * Held as field factories rather than fields because a vine schema is a builder that carries its
 * own modifiers — the create and patch schemas each need their own instance. One record is what
 * keeps the two from drifting, and lets the frozen-once-generated key list fall out of the same
 * source instead of being maintained beside it.
 */
const planFields = {
  standLocation: () => vine.string().minLength(1),
  branches: () => vine.array(vine.string()).minLength(1),
  deadline: () => calendarDate(),
  meetingDate: () => calendarDate(),
  userMeetingFrom: () => slotTime(),
  userMeetingTo: () => slotTime().use(laterThan("userMeetingFrom")),
  standFrom: () => slotTime(),
  standTo: () => slotTime().use(laterThan("standFrom")),
  includeCustomerItemsFromOtherBranches: () => vine.boolean(),
  userMatchLocations: () => vine.array(vine.string().minLength(1)).minLength(1),
  excludedCustomerIds: () => vine.array(vine.string().minLength(1)),
};
type PlanFields = typeof planFields;

const buildPlanFields = () =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.fromEntries erases the key/value pairing TS can see in planFields; the assertion restores it
  Object.fromEntries(Object.entries(planFields).map(([key, field]) => [key, field()])) as {
    [K in keyof PlanFields]: ReturnType<PlanFields[K]>;
  };

/** The same fields, each made optional — VineJS has no `.partial()` on an assembled object. */
const buildOptionalPlanFields = () =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.fromEntries erases the key/value pairing TS can see in planFields; the assertion restores it
  Object.fromEntries(
    Object.entries(planFields).map(([key, field]) => [key, field().optional()]),
  ) as { [K in keyof PlanFields]: ReturnType<ReturnType<PlanFields[K]>["optional"]> };

export const matchRoundPlanSchema = vine.object({
  name: vine.string().minLength(1),
  ...buildPlanFields(),
});
export const matchRoundCreateValidator = vine.create(matchRoundPlanSchema);

export const matchNotifySchema = vine.object({
  target: vine.enum(["user-matches", "stand-only", "all"]),
  message: vine.string().minLength(10),
  roundId: vine.number().withoutDecimals().positive().optional(),
});
export const matchNotifyValidator = vine.create(matchNotifySchema);

export const matchTransferSchema = vine.object({
  blid: vine.string(),
});
export const matchTransferValidator = vine.create(matchTransferSchema);

/**
 * A round is edited in two quite different ways: its name and visibility can change at any time,
 * while the plan itself may only change before the round has been generated. Both arrive here; the
 * controller is what refuses plan edits once matches exist.
 */
export const matchRoundPatchSchema = vine.object({
  name: vine.string().minLength(1).optional(),
  status: vine.enum(["draft", "active"]).optional(),
  ...buildOptionalPlanFields(),
});
export const matchRoundPatchValidator = vine.create(matchRoundPatchSchema);

/**
 * The patch keys that describe the plan, and so freeze once the round has been generated.
 *
 * Read off the plan itself, so a field added to the plan freezes with it rather than staying
 * silently editable until someone remembers to list it here too.
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.keys widens to string[]; planFields is a closed local object so its keys are exactly keyof PlanFields
export const PLAN_PATCH_KEYS = Object.keys(planFields) as (keyof PlanFields)[];
