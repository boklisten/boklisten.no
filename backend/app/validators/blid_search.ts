import vine from "@vinejs/vine";

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export const blidActiveItemUpdateValidator = vine.create(
  vine.object({
    customerItemId: vine.string().regex(OBJECT_ID_PATTERN),
    deadline: vine.string().regex(ISO_DATE_PATTERN).optional(),
    branchId: vine.string().regex(OBJECT_ID_PATTERN).optional(),
  }),
);
