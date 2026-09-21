export const USER_PERMISSION = {
  CUSTOMER: "customer",
  EMPLOYEE: "employee",
  ADMIN: "admin",
} as const satisfies Record<Uppercase<string>, Lowercase<string>>;

export type UserPermission = (typeof USER_PERMISSION)[keyof typeof USER_PERMISSION];

export const PERMISSION_LEVELS = {
  customer: 0,
  employee: 1,
  admin: 2,
} as const satisfies Record<UserPermission, number>;

/** Whether `permission` is `required` or a higher level: an admin may do everything an employee may. */
export function hasPermissionLevel(permission: UserPermission, required: UserPermission): boolean {
  return PERMISSION_LEVELS[permission] >= PERMISSION_LEVELS[required];
}
