import vine from "@vinejs/vine";

export const openingHoursValidator = vine.create(
  vine.object({
    branchId: vine.string(),
    opensAt: vine.date({ formats: ["iso8601"] }).afterOrEqual("today"),
    closesAt: vine.date({ formats: ["iso8601"] }).afterOrEqual("today"),
  }),
);
