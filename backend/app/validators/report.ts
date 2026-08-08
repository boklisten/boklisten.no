import vine from "@vinejs/vine";

import { dateStringField, objectIdField } from "#validators/common/fields";

export const customerItemsReportValidator = vine.create({
  branchFilter: vine.array(objectIdField.clone()).optional(),
  createdAfter: dateStringField.clone().optional(),
  createdBefore: dateStringField.clone().optional(),
  deadlineAfter: dateStringField.clone().optional(),
  deadlineBefore: dateStringField.clone().optional(),
  includeReturned: vine.boolean().optional(),
  includeBuyout: vine.boolean().optional(),
});

export const ordersReportValidator = vine.create({
  branchFilter: vine.array(objectIdField.clone()).optional(),
  createdAfter: dateStringField.clone().optional(),
  createdBefore: dateStringField.clone().optional(),
});

export const paymentsReportValidator = vine.create({
  branchFilter: vine.array(objectIdField.clone()).optional(),
  createdAfter: dateStringField.clone().optional(),
  createdBefore: dateStringField.clone().optional(),
});

export const userDetailsReportValidator = vine.create({
  branchFilter: vine.array(objectIdField.clone()).optional(),
});
