import { hasPermissionLevel } from "#shared/user-permission";
import type { UserPermission } from "#shared/user-permission";

/**
 * Who sees a branch, from the most to the least public: `public` branches are shown everywhere
 * and customers may order from them online, `employee` branches only to employees and admins, and
 * `admin` branches only to admins. Each branch has its own; a class may be more public than its
 * school.
 */
export const BRANCH_VISIBILITIES = ["public", "employee", "admin"] as const;
export type BranchVisibility = (typeof BRANCH_VISIBILITIES)[number];

const REQUIRED_PERMISSION = {
  public: null,
  employee: "employee",
  admin: "admin",
} as const satisfies Record<BranchVisibility, UserPermission | null>;

/** Whether a viewer with `permission` (`null` for a guest) may see a branch with `visibility`. */
export function canSeeBranch(
  permission: UserPermission | null,
  visibility: BranchVisibility,
): boolean {
  const required = REQUIRED_PERMISSION[visibility];
  return required === null || (permission !== null && hasPermissionLevel(permission, required));
}

/** The visibilities a viewer with `permission` may see. */
export function visibilitiesFor(permission: UserPermission | null): BranchVisibility[] {
  return BRANCH_VISIBILITIES.filter((visibility) => canSeeBranch(permission, visibility));
}
