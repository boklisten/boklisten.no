import vine from "@vinejs/vine";

import { calendarDateField } from "#validators/common/fields";
import { BLID_SEARCH_PATTERN } from "#shared/blid_search";

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

export const blidActiveItemUpdateValidator = vine.create(
  vine.object({
    customerItemId: vine.string().regex(OBJECT_ID_PATTERN),
    deadline: calendarDateField.clone().optional(),
    branchId: vine.string().regex(OBJECT_ID_PATTERN).optional(),
  }),
);

export const blidRelinkValidator = vine.create(
  vine.object({
    itemId: vine.string().regex(OBJECT_ID_PATTERN),
  }),
);

export const blidSearchQueryValidator = vine.create(
  vine.object({
    q: vine.string().trim().regex(BLID_SEARCH_PATTERN),
  }),
);
