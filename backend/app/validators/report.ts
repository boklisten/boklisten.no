import vine from "@vinejs/vine";

import { calendarDateField, dateStringField, objectIdField } from "#validators/common/fields";

export const customerItemsReportValidator = vine.create({
  branchFilter: vine.array(objectIdField.clone()).optional(),
  createdAfter: dateStringField.clone().optional(),
  createdBefore: dateStringField.clone().optional(),
  deadlineAfter: calendarDateField.clone().optional(),
  deadlineBefore: calendarDateField.clone().optional(),
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

export const usersReportValidator = vine.create({
  branchFilter: vine.array(objectIdField.clone()).optional(),
});
