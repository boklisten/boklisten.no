import vine from "@vinejs/vine";

import { calendarDateField } from "#validators/common/fields";

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

function objectIdString() {
  return vine.string().regex(OBJECT_ID_PATTERN);
}

export const branchBooksDetailsValidator = vine.create(
  vine.object({
    deadline: calendarDateField.clone(),
    itemId: objectIdString(),
  }),
);

export const activeBooksBulkUpdateValidator = vine.create(
  vine.object({
    filter: vine.object({
      deadline: calendarDateField.clone().optional(),
      itemId: objectIdString().optional(),
      customerItemIds: vine.array(objectIdString()).minLength(1).optional(),
      includeDescendants: vine.boolean(),
    }),
    update: vine.object({
      deadline: calendarDateField.clone().optional(),
      branchId: objectIdString().optional(),
    }),
  }),
);

export const orderedBooksBulkUpdateValidator = vine.create(
  vine.object({
    filter: vine.object({
      deadline: calendarDateField.clone().optional(),
      itemId: objectIdString().optional(),
      orderItemIds: vine.array(vine.number().withoutDecimals().min(1)).minLength(1).optional(),
      includeDescendants: vine.boolean(),
    }),
    update: vine.object({
      deadline: calendarDateField.clone().optional(),
      branchId: objectIdString().optional(),
    }),
  }),
);

export const orderedBooksCancelValidator = vine.create({
  filter: vine.object({
    deadline: calendarDateField.clone().optional(),
    itemId: objectIdString().optional(),
    orderItemIds: vine.array(vine.number().withoutDecimals().min(1)).minLength(1).optional(),
    includeDescendants: vine.boolean(),
  }),
  notifyCustomers: vine.boolean(),
});
