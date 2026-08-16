import vine from "@vinejs/vine";

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function objectIdString() {
  return vine.string().regex(OBJECT_ID_PATTERN);
}

function deadlineString() {
  return vine.string().regex(ISO_DATE_PATTERN);
}

export const branchBooksDetailsValidator = vine.create(
  vine.object({
    deadlines: vine.array(deadlineString()).minLength(1),
    itemId: objectIdString(),
  }),
);

export const activeBooksBulkUpdateValidator = vine.create(
  vine.object({
    filter: vine.object({
      deadlines: vine.array(deadlineString()).minLength(1).optional(),
      itemId: objectIdString().optional(),
      customerItemIds: vine.array(objectIdString()).minLength(1).optional(),
      includeDescendants: vine.boolean(),
    }),
    update: vine.object({
      deadline: deadlineString().optional(),
      branchId: objectIdString().optional(),
    }),
  }),
);

export const orderedBooksBulkUpdateValidator = vine.create(
  vine.object({
    filter: vine.object({
      deadlines: vine.array(deadlineString()).minLength(1).optional(),
      itemId: objectIdString().optional(),
      orderItemIds: vine.array(objectIdString()).minLength(1).optional(),
      includeDescendants: vine.boolean(),
    }),
    update: vine.object({
      deadline: deadlineString().optional(),
      branchId: objectIdString().optional(),
    }),
  }),
);

export const orderedBooksCancelValidator = vine.create({
  filter: vine.object({
    deadlines: vine.array(deadlineString()).minLength(1).optional(),
    itemId: objectIdString().optional(),
    orderItemIds: vine.array(objectIdString()).minLength(1).optional(),
    includeDescendants: vine.boolean(),
  }),
  notifyCustomers: vine.boolean(),
});
