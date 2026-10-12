import vine from "@vinejs/vine";

import { USER_PERMISSION } from "#shared/user-permission";
import { objectIdField } from "#validators/common/fields";

export const mergeUsersValidator = vine.create({
  fromUserId: vine.string(),
  toUserId: vine.string(),
});

export const setPermissionValidator = vine.create({
  userIds: vine.array(vine.string()).minLength(1),
  permission: vine.enum(USER_PERMISSION),
  /** The home node for employees; ignored for other levels, which always get the root. */
  employeeBranchId: vine.string().optional(),
});

/** The node a user list or metric is asked for; it covers the node and the branches below it. */
export const branchScopedValidator = vine.create({
  branchId: objectIdField.clone(),
});
