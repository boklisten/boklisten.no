import { Bouncer } from "@adonisjs/bouncer";

import type User from "#models/user";
import type { UserPermission } from "#shared/user-permission";
import { hasPermissionLevel } from "#shared/user-permission";

/** The permission levels are ordered, so a manager may do everything an employee may. */
export const hasPermission = Bouncer.ability((user: User, required: UserPermission) =>
  hasPermissionLevel(user.permission, required),
);
