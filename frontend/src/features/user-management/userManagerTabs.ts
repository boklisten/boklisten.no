/**
 * Lives apart from `UserManager` because the route's `validateSearch` needs it, and everything
 * a route imports outside its component ends up in the entry bundle for every visitor.
 */
const USER_MANAGER_TABS = ["kunder", "ansatte"] as const;
export type UserManagerTab = (typeof USER_MANAGER_TABS)[number];

export function parseUserManagerTab(value: unknown): UserManagerTab | undefined {
  return USER_MANAGER_TABS.find((tab) => tab === value);
}
