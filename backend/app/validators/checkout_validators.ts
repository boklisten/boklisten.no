import vine from "@vinejs/vine";
import type { Infer } from "@vinejs/vine/types";

export const initializeCheckoutValidator = vine.create(
  vine.object({
    cartItems: vine.array(
      vine.object({
        id: vine.string(),
        branchId: vine.string(),
        type: vine.enum(["rent", "partly-payment", "extend", "buy", "buyout"]),
        to: vine.date().optional(),
      }),
    ),
  }),
);

const vippsCheckoutSessionSchema = vine.object({
  reference: vine.string(),
  sessionState: vine.string(),
  paymentMethod: vine.string().optional().nullable(),
  billingDetails: vine
    .object({
      firstName: vine.string(),
      lastName: vine.string(),
      email: vine.string(),
      phoneNumber: vine.string(),
      streetAddress: vine.string().optional().nullable(),
      postalCode: vine.string().optional().nullable(),
      city: vine.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  shippingDetails: vine
    .object({
      firstName: vine.string().optional().nullable(),
      lastName: vine.string().optional().nullable(),
      email: vine.string().optional().nullable(),
      phoneNumber: vine.string().optional().nullable(),
      streetAddress: vine.string().optional().nullable(),
      postalCode: vine.string().optional().nullable(),
      city: vine.string().optional().nullable().optional().nullable(),
      shippingMethodId: vine.string().optional().nullable(),
      amount: vine
        .object({
          value: vine.number(),
        })
        .optional()
        .nullable(),
    })
    .optional()
    .nullable(),
});

export const vippsCheckoutSessionValidator = vine.create(vippsCheckoutSessionSchema);
export type VippsCheckoutSession = Infer<typeof vippsCheckoutSessionSchema>;
