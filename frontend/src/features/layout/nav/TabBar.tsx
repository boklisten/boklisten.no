import type { Icon } from "@tabler/icons-react";
import { Box } from "@mantine/core";

import MenuButton from "@/features/layout/nav/MenuButton";
import classes from "@/features/layout/nav/Nav.module.css";
import type { FileRouteTypes } from "@/routeTree.gen";
import TanStackAnchor from "@/shared/components/TanStackAnchor";

export interface Tab {
  label: string;
  to: FileRouteTypes["to"];
  icon: Icon;
  active: boolean;
}

/**
 * The phone navigation, shared by the public site and bl-admin: a few destinations within thumb
 * reach and a last tab that opens the menu sheet with everything else. One highlighter swipe sits
 * behind the current page's icon and glides to the next; the tabs are equal columns, so its place
 * is the tab's index. Hidden from `sm` up, where the top bar or the sidebar carries the same items.
 */
export default function TabBar({
  tabs,
  menuOpened,
  onOpenMenu,
}: {
  tabs: Tab[];
  menuOpened: boolean;
  onOpenMenu: () => void;
}) {
  const activeIndex = tabs.findIndex((tab) => tab.active);

  return (
    <nav className={classes.tabBar} aria-label="Hovedmeny">
      <Box
        component="span"
        className={classes.tabMarker}
        data-visible={activeIndex === -1 ? undefined : ""}
        style={{ "--tab-index": Math.max(activeIndex, 0), "--tab-count": tabs.length + 1 }}
        aria-hidden
      />
      {tabs.map((tab) => (
        <TanStackAnchor
          key={tab.to}
          to={tab.to}
          className={classes.tab}
          underline="never"
          data-active={tab.active || undefined}
          aria-current={tab.active ? "page" : undefined}
        >
          <span className={classes.tabIcon}>
            <tab.icon size={24} stroke={tab.active ? 2 : 1.6} aria-hidden />
          </span>
          {tab.label}
        </TanStackAnchor>
      ))}
      <MenuButton
        className={classes.tab}
        iconClassName={classes.tabIcon}
        opened={menuOpened}
        onOpen={onOpenMenu}
      />
    </nav>
  );
}
