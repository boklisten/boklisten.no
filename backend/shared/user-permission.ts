export const USER_PERMISSION = {
  CUSTOMER: "customer",
  EMPLOYEE: "employee",
  MANAGER: "manager",
  ADMIN: "admin",
} as const satisfies Record<Uppercase<string>, Lowercase<string>>;

export type UserPermission = (typeof USER_PERMISSION)[keyof typeof USER_PERMISSION];

export const PERMISSION_LEVELS = {
  customer: 0,
  employee: 1,
  manager: 2,
  admin: 3,
} as const satisfies Record<UserPermission, number>;
