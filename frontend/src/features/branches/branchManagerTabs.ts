/**
 * Lives apart from `BranchManager` because the route's `validateSearch` needs it, and everything
 * a route imports outside its component ends up in the entry bundle for every visitor.
 */
const BRANCH_MANAGER_TABS = [
  "general",
  "relationships",
  "payment",
  "books",
  "subjects",
  "hours",
  "members",
  "signatures",
  "active-books",
  "ordered-books",
  "insights",
] as const;
export type BranchManagerTab = (typeof BRANCH_MANAGER_TABS)[number];

export function parseBranchManagerTab(value: unknown): BranchManagerTab | undefined {
  return BRANCH_MANAGER_TABS.find((tab) => tab === value);
}
