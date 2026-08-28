export const USER_PERMISSION = {
  CUSTOMER: "customer",
  EMPLOYEE: "employee",
  MANAGER: "manager",
  ADMIN: "admin",
} as const satisfies Record<Uppercase<string>, Lowercase<string>>;

export type UserPermission = (typeof USER_PERMISSION)[keyof typeof USER_PERMISSION];

/** The permission a value claims, falling back to customer when it is missing or unknown. */
export function parsePermission(value: unknown): UserPermission {
  return (
    Object.values(USER_PERMISSION).find((permission) => permission === value) ??
    USER_PERMISSION.CUSTOMER
  );
}

export const PERMISSION_LEVELS = {
  customer: 0,
  employee: 1,
  manager: 2,
  admin: 3,
} as const satisfies Record<UserPermission, number>;
