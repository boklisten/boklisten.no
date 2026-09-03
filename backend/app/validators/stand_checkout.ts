import vine from "@vinejs/vine";

export const startStandCheckoutValidator = vine.create(
  vine.object({
    customerItemId: vine.string().trim(),
    action: vine.object({
      type: vine.enum(["buyout", "extend"]),
      /** The new deadline; only for extensions. */
      to: vine.date().optional(),
    }),
    payment: vine.object({
      method: vine.enum(["card", "vipps"]),
      /** Only for Vipps: the phone the request is pushed to. */
      phoneNumber: vine.string().trim().optional(),
    }),
  }),
);
