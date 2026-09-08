import vine from "@vinejs/vine";

import { BRING_PARCEL_TYPES } from "#shared/order_manager";
import { objectIdField } from "#validators/common/fields";

const filterFields = {
  branchIds: vine.array(objectIdField.clone()).optional(),
  bringOnly: vine.boolean().optional(),
};

export const orderManagerListValidator = vine.create({
  ...filterFields,
  cursor: vine.string().optional(),
  limit: vine.number().withoutDecimals().min(1).max(200).optional(),
});

export const orderManagerReportValidator = vine.create(filterFields);

export const orderManagerBringReportValidator = vine.create({
  ...filterFields,
  parcelType: vine.enum(BRING_PARCEL_TYPES),
});
