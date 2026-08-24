import vine from "@vinejs/vine";

import { USER_PERMISSION } from "#shared/user-permission";

export const mergeUsersValidator = vine.create({
  fromDetailsId: vine.string(),
  toDetailsId: vine.string(),
});

export const setPermissionValidator = vine.create({
  detailsIds: vine.array(vine.string()).minLength(1),
  permission: vine.enum(USER_PERMISSION),
});
