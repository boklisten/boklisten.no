import vine from "@vinejs/vine";

import { objectIdField, percentageField } from "#validators/common/fields";
import { BRANCH_TYPES } from "#shared/branch";
import env from "#start/env";

const logoField = vine
  .string()
  .url({ require_tld: env.get("API_ENV") !== "dev", require_protocol: true });
const periodTypeField = vine.enum(["semester", "year"]);

const rentPeriodSchema = vine.object({
  type: periodTypeField,
  date: vine.date(),
  maxNumberOfPeriods: vine.number().positive(),
  percentage: percentageField,
});

const extendPeriodSchema = vine.object({
  type: periodTypeField,
  date: vine.date(),
  maxNumberOfPeriods: vine.number().positive(),
  price: vine.number().positive(),
  percentage: percentageField.nullable(),
});

const partlyPaymentPeriodSchema = vine.object({
  type: periodTypeField,
  date: vine.date(),
  percentageBuyout: percentageField,
  percentageBuyoutUsed: percentageField,
  percentageUpFront: percentageField,
  percentageUpFrontUsed: percentageField,
});

export const branchCreateValidator = vine.create(
  vine.object({
    name: vine.string().trim(),
    logo: logoField.nullable().optional(),
    region: vine.string().trim(),
    address: vine.string().trim().nullable().optional(),
    type: vine.enum(BRANCH_TYPES).nullable(),
  }),
);

/** PATCH: every field optional, period lists replace the stored list of that kind when present. */
export const branchValidator = vine.create(
  vine.object({
    name: vine.string().trim().optional(),
    logo: logoField.nullable().optional(),
    region: vine.string().trim().optional(),
    address: vine.string().trim().nullable().optional(),
    type: vine.enum(BRANCH_TYPES).nullable().optional(),
    active: vine.boolean().optional(),
    branchItemsLiveOnline: vine.boolean().optional(),
    branchItemsLiveAtBranch: vine.boolean().optional(),
    paymentResponsible: vine.boolean().optional(),
    responsibleForDelivery: vine.boolean().optional(),
    buyoutPercentage: percentageField.optional(),
    sellPercentage: percentageField.optional(),
    deliveryAtBranch: vine.boolean().optional(),
    deliveryByMail: vine.boolean().optional(),
    rentPeriods: vine.array(rentPeriodSchema).optional(),
    extendPeriods: vine.array(extendPeriodSchema).optional(),
    partlyPaymentPeriods: vine.array(partlyPaymentPeriodSchema).optional(),
  }),
);

/**
 * `childBranchIds` is a command, not a stored list: the branches named become children of `id`
 * and its previous children that are missing from the list stop being children.
 */
export const branchRelationshipValidator = vine.create(
  vine.object({
    id: objectIdField,
    localName: vine.string().trim().nullable().optional(),
    parentBranchId: objectIdField.nullable().optional(),
    childBranchIds: vine.array(objectIdField).optional(),
    childLabel: vine.string().trim().nullable().optional(),
  }),
);
