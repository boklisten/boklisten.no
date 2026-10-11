import { hasPermissionLevel } from "#shared/user-permission";
import type { UserPermission } from "#shared/user-permission";

/**
 * Whether a viewer with `permission` (`null` for a guest) may see a branch. Staff see every
 * branch; customers and guests only those a branch's `visibleToCustomers` opens to them. Which
 * branches an employee works with is their home node's business, not visibility's.
 */
export function canSeeBranch(
  permission: UserPermission | null,
  visibleToCustomers: boolean,
): boolean {
  return visibleToCustomers || (permission !== null && hasPermissionLevel(permission, "employee"));
}
