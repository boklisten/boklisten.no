import vine from "@vinejs/vine";

import { STAND_CART_ACTION_TYPES, STAND_CART_CONFIRMATIONS } from "#shared/stand_cart";

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

const objectId = () => vine.string().regex(OBJECT_ID_PATTERN);

const orderSource = vine.object({
  kind: vine.literal("order"),
  orderId: objectId(),
  itemId: objectId(),
});
const customerItemSource = vine.object({
  kind: vine.literal("customerItem"),
  customerItemId: objectId(),
});
const itemSource = vine.object({
  kind: vine.literal("item"),
  itemId: objectId(),
  blid: vine.string().trim(),
});
const blidLookup = vine.object({ kind: vine.literal("blid"), blid: vine.string().trim() });

const ofKind = (kind: string) => (value: Record<string, unknown>) => value["kind"] === kind;

/** A line's source: which fields apply follows from `kind`. */
const sourceSchema = vine.union([
  vine.union.if(ofKind("order"), orderSource),
  vine.union.if(ofKind("customerItem"), customerItemSource),
  vine.union.if(ofKind("item"), itemSource),
]);

/** A source, or a bare scan the server places. */
const lookupSchema = vine.union([
  vine.union.if(ofKind("order"), orderSource),
  vine.union.if(ofKind("customerItem"), customerItemSource),
  vine.union.if(ofKind("item"), itemSource),
  vine.union.if(ofKind("blid"), blidLookup),
]);

export const standCartResolveValidator = vine.create(
  vine.object({
    customerId: objectId(),
    branchId: objectId(),
    source: lookupSchema,
    /** A scanned copy to attach to an order line. */
    blid: vine.string().trim().optional(),
    /** Keys already in the cart, so a scanned blid never joins a line the cart already has. */
    takenKeys: vine.array(vine.string()).optional(),
  }),
);

export const standCartCheckoutValidator = vine.create(
  vine.object({
    customerId: objectId(),
    branchId: objectId(),
    lines: vine
      .array(
        vine.object({
          source: sourceSchema,
          choice: vine.object({
            type: vine.enum(STAND_CART_ACTION_TYPES),
            /** ISO timestamp. */
            to: vine.string().optional(),
          }),
          blid: vine.string().trim().optional(),
          /** The price the cart showed; the checkout refuses when the server's differs. */
          expectedPrice: vine.number(),
        }),
      )
      .minLength(1),
    payment: vine
      .object({
        method: vine.enum(["cash", "card", "vipps"]),
        /** Only for Vipps: the phone the request is pushed to. */
        phoneNumber: vine.string().trim().optional(),
      })
      .nullable(),
    delivery: vine.object({ trackingNumber: vine.string().trim().minLength(1) }).nullable(),
    notifyByEmail: vine.boolean(),
    confirmed: vine.array(vine.enum(STAND_CART_CONFIRMATIONS)),
  }),
);
