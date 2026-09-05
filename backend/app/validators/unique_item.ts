import vine from "@vinejs/vine";

import { BLID_PATTERN, ISBN_PATTERN } from "#validators/blid_registration";

export const uniqueItemsValidator = vine.create(
  vine.object({
    blid: vine.string().trim().regex(BLID_PATTERN),
    isbn: vine.string().trim().regex(ISBN_PATTERN),
  }),
);
