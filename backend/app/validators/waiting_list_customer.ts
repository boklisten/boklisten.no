import vine from "@vinejs/vine";

import { phoneField } from "#validators/common/fields";

export const waitingListCustomerValidator = vine.create(
  vine.object({
    name: vine.string(),
    phone: phoneField.clone(),
    itemId: vine.string(),
    branchId: vine.string(),
  }),
);
