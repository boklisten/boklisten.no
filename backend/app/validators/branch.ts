import vine from "@vinejs/vine";

import { percentageField } from "#validators/common/fields";
import env from "#start/env";

export const branchCreateValidator = vine.create(
  vine.object({
    name: vine.string(),
    logo: vine
      .string()
      .url({ require_tld: env.get("API_ENV") !== "dev", require_protocol: true })
      .optional(),
    location: vine.object({
      region: vine.string(),
      address: vine.string().optional(),
    }),
    type: vine.string().nullable(),
  }),
);

export const branchValidator = vine.create(
  vine.object({
    id: vine.string().optional(),
    name: vine.string().optional(),
    logo: vine
      .string()
      .url({ require_tld: env.get("API_ENV") !== "dev", require_protocol: true })
      .optional(),
    location: vine
      .object({
        region: vine.string().optional(),
        address: vine.string().optional(),
      })
      .optional(),
    type: vine.string().nullable().optional(),
    active: vine.boolean().optional(),
    isBranchItemsLive: vine
      .object({
        online: vine.boolean(),
        atBranch: vine.boolean(),
      })
      .optional(),
    paymentInfo: vine
      .object({
        responsible: vine.boolean().optional(),
        responsibleForDelivery: vine.boolean().optional(),
        partlyPaymentPeriods: vine
          .array(
            vine.object({
              type: vine.enum(["semester", "year"]),
              date: vine.date(),
              percentageBuyout: percentageField,
              percentageBuyoutUsed: percentageField,
              percentageUpFront: percentageField,
              percentageUpFrontUsed: percentageField,
            }),
          )
          .optional(),
        rentPeriods: vine
          .array(
            vine.object({
              type: vine.enum(["semester", "year"]),
              date: vine.date(),
              maxNumberOfPeriods: vine.number().positive(),
              percentage: percentageField,
            }),
          )
          .optional(),
        extendPeriods: vine
          .array(
            vine
              .object({
                type: vine.enum(["semester", "year"]),
                date: vine.date(),
                maxNumberOfPeriods: vine.number().positive(),
                price: vine.number().positive(),
                percentage: percentageField.optional(),
              })
              .optional(),
          )
          .optional(),
        buyout: vine
          .object({
            percentage: percentageField,
          })
          .optional(),
        sell: vine
          .object({
            percentage: percentageField,
          })
          .optional(),
      })
      .optional(),
    deliveryMethods: vine
      .object({
        branch: vine.boolean(),
        byMail: vine.boolean(),
      })
      .optional(),
  }),
);

export const branchRelationshipValidator = vine.create(
  vine.object({
    id: vine.string(),
    localName: vine.string().optional(),
    parentBranch: vine.string().optional(),
    childBranches: vine.array(vine.string()).optional(),
    childLabel: vine.string().optional(),
  }),
);
