export const USER_PERMISSION = {
  CUSTOMER: "customer",
  EMPLOYEE: "employee",
  MANAGER: "manager",
  ADMIN: "admin",
} as const satisfies Record<Uppercase<string>, Lowercase<string>>;

export type UserPermission = (typeof USER_PERMISSION)[keyof typeof USER_PERMISSION];

/**
 * The levels are ordered: a manager (Filialsjef) may do everything an employee may, and an admin
 * everything a manager may. Employees do the operational work (Kasse, Ordreoversikt, Venteliste,
 * Merking); managers also run the Filialer workspace for their branches; admins run the whole
 * service.
 */
export const PERMISSION_LEVELS = {
  customer: 0,
  employee: 1,
  manager: 2,
  admin: 3,
} as const satisfies Record<UserPermission, number>;

/** Whether `permission` is `required` or a higher level: an admin may do everything an employee may. */
export function hasPermissionLevel(permission: UserPermission, required: UserPermission): boolean {
  return PERMISSION_LEVELS[permission] >= PERMISSION_LEVELS[required];
}
