import vine from "@vinejs/vine";

import { calendarDateField, objectIdField, percentageField } from "#validators/common/fields";
import { BRANCH_TYPES } from "#shared/branch";
import { INHERITED_BRANCH_FIELDS } from "#shared/branch-inheritance";
import { BRANCH_VISIBILITIES } from "#shared/branch-visibility";
import env from "#start/env";

const logoField = vine
  .string()
  .url({ require_tld: env.get("API_ENV") !== "dev", require_protocol: true });
const periodTypeField = vine.enum(["semester", "year"]);

const rentPeriodSchema = vine.object({
  type: periodTypeField,
  date: calendarDateField.clone(),
  maxNumberOfPeriods: vine.number().positive(),
  percentage: percentageField,
});

const extendPeriodSchema = vine.object({
  type: periodTypeField,
  date: calendarDateField.clone(),
  maxNumberOfPeriods: vine.number().positive(),
  price: vine.number().positive(),
  percentage: percentageField.nullable(),
});

const partlyPaymentPeriodSchema = vine.object({
  type: periodTypeField,
  date: calendarDateField.clone(),
  percentageBuyout: percentageField,
  percentageUpFront: percentageField,
});

/**
 * `include` names one more branch to return even when the viewer could not see it otherwise: the
 * membership a school picker shows as the current value. A customer may only include their own.
 */
export const branchIndexValidator = vine.create(
  vine.object({
    include: objectIdField.clone().optional(),
  }),
);

/** Stored capitalised ("Oslo"), as the order flow groups the branches by it. */
const regionField = vine
  .string()
  .trim()
  .transform((region) => region.charAt(0).toUpperCase() + region.slice(1));

export const branchCreateValidator = vine.create(
  vine.object({
    name: vine.string().trim(),
    logo: logoField.nullable().optional(),
    region: regionField.clone(),
    address: vine.string().trim().nullable().optional(),
    type: vine.enum(BRANCH_TYPES).nullable(),
    /** The branch to create under; `null` creates a root. Every inherited field starts as the parent's. */
    parentBranchId: objectIdField.clone().nullable(),
  }),
);

/**
 * PATCH: every field optional, period lists replace the stored list of that kind when present. An
 * inherited field set to a value overrides the parent's; `null` inherits from the parent.
 */
export const branchValidator = vine.create(
  vine.object({
    name: vine.string().trim().optional(),
    logo: logoField.nullable().optional(),
    region: regionField.clone().optional(),
    address: vine.string().trim().nullable().optional(),
    type: vine.enum(BRANCH_TYPES).nullable().optional(),
    visibility: vine.enum(BRANCH_VISIBILITIES).nullable().optional(),
    paymentResponsible: vine.boolean().nullable().optional(),
    responsibleForDelivery: vine.boolean().nullable().optional(),
    buyoutPercentage: percentageField.nullable().optional(),
    sellPercentage: percentageField.nullable().optional(),
    deliveryAtBranch: vine.boolean().nullable().optional(),
    deliveryByMail: vine.boolean().nullable().optional(),
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

/** Every descendant inherits `field` again ("Tilbakestill alle" in the descendant tree). */
export const branchInheritBelowValidator = vine.create(
  vine.object({
    field: vine.enum(INHERITED_BRANCH_FIELDS),
  }),
);
