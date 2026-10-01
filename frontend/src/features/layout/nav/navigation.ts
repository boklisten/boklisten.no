import type { Icon } from "@tabler/icons-react";
import { useLocation } from "@tanstack/react-router";

import type { FileRouteTypes } from "@/routeTree.gen";

/** One destination in either site's navigation: the bars, the tab bar, the menu and the sidebar. */
export interface NavLink {
  label: string;
  to: FileRouteTypes["to"];
  icon: Icon;
  /** One line under the label in the menu, for links whose name alone does not say what they do. */
  hint?: string;
  /** Marks the link active on this prefix; the route itself when unset. */
  activeOn?: string;
  /** Matches the route alone, for a home whose route is the parent of every other page. */
  exact?: true;
}

/** The teal bar over both sites, so the logo stands in the same place on either. */
export const TOP_BAR_HEIGHT = 60;

/** Marks the link active on its route (or `activeOn`) and every page below it. */
export function isNavLinkActive(
  link: Pick<NavLink, "to" | "activeOn" | "exact">,
  pathname: string,
): boolean {
  if (link.exact) {
    return pathname === link.to;
  }
  const prefix = link.activeOn ?? link.to;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function usePathname() {
  return useLocation({ select: (location) => location.pathname });
}
