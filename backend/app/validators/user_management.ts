import vine from "@vinejs/vine";

import { USER_PERMISSION } from "#shared/user-permission";

export const mergeUsersValidator = vine.create({
  fromUserId: vine.string(),
  toUserId: vine.string(),
});

export const setPermissionValidator = vine.create({
  userIds: vine.array(vine.string()).minLength(1),
  permission: vine.enum(USER_PERMISSION),
});
