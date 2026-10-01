import { Box } from "@mantine/core";

import MenuButton from "@/features/layout/nav/MenuButton";
import NavAnchor from "@/features/layout/nav/NavAnchor";
import classes from "@/features/layout/nav/Nav.module.css";
import { isNavLinkActive, usePathname } from "@/features/layout/nav/navigation";
import type { NavLink } from "@/features/layout/nav/navigation";

/**
 * The phone navigation, shared by the public site and bl-admin: a few destinations within thumb
 * reach and a last tab that opens the menu sheet with everything else. One highlighter swipe sits
 * behind the current page's icon and glides to the next; the tabs are equal columns, so its place
 * is the tab's index. Hidden from `sm` up, where the top bar or the sidebar carries the same items.
 */
export default function TabBar({
  links,
  menuOpened,
  onOpenMenu,
}: {
  links: NavLink[];
  menuOpened: boolean;
  onOpenMenu: () => void;
}) {
  const pathname = usePathname();
  const activeIndex = links.findIndex((link) => isNavLinkActive(link, pathname));

  return (
    <nav className={classes.tabBar} aria-label="Hovedmeny">
      <Box
        component="span"
        className={classes.tabMarker}
        data-visible={activeIndex === -1 ? undefined : ""}
        style={{ "--tab-index": Math.max(activeIndex, 0), "--tab-count": links.length + 1 }}
        aria-hidden
      />
      {links.map((link, index) => {
        const active = index === activeIndex;
        return (
          <NavAnchor key={link.to} to={link.to} active={active} className={classes.tab}>
            <span className={classes.tabIcon}>
              <link.icon size={24} stroke={active ? 2 : 1.6} aria-hidden />
            </span>
            {link.label}
          </NavAnchor>
        );
      })}
      <MenuButton
        className={classes.tab}
        iconClassName={classes.tabIcon}
        opened={menuOpened}
        onOpen={onOpenMenu}
      />
    </nav>
  );
}
