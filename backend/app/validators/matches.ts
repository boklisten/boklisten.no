import vine from "@vinejs/vine";

const slotTime = () => vine.string().regex(/^(?:[01]\d|2[0-3]):[0-5]0$/);
const meetingWindow = () => vine.object({ from: slotTime(), to: slotTime() });

export const matchGenerateSchema = vine.object({
  name: vine.string().minLength(1),
  branches: vine.array(vine.string()),
  standLocation: vine.string(),
  meetingDate: vine.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  userMeetingWindow: meetingWindow(),
  standWindow: meetingWindow(),
  userMatchLocations: vine.array(vine.string().minLength(1)).minLength(1),
  deadlineBefore: vine.date(),
  includeCustomerItemsFromOtherBranches: vine.boolean(),
});
export const matchGenerateValidator = vine.create(matchGenerateSchema);

export const matchNotifySchema = vine.object({
  target: vine.enum(["user-matches", "stand-only", "all"]),
  message: vine.string().minLength(10),
  roundId: vine.number().withoutDecimals().positive().optional(),
});
export const matchNotifyValidator = vine.create(matchNotifySchema);

export const matchLockSchema = vine.object({
  customerId: vine.string(),
  userMatchesLocked: vine.boolean(),
});

export const matchLockValidator = vine.create(matchLockSchema);

export const matchTransferSchema = vine.object({
  blid: vine.string(),
});
export const matchTransferValidator = vine.create(matchTransferSchema);

export const matchRoundPatchSchema = vine.object({
  name: vine.string().minLength(1).optional(),
  status: vine.enum(["draft", "active"]).optional(),
});
export const matchRoundPatchValidator = vine.create(matchRoundPatchSchema);
