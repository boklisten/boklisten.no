import { Box } from "@mantine/core";
import { useLocation } from "@tanstack/react-router";

import MenuButton from "@/features/layout/public-nav/MenuButton";
import { isActive, primaryLinks } from "@/features/layout/public-nav/publicNavigation";
import classes from "@/features/layout/public-nav/PublicNav.module.css";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import useAuth from "@/shared/hooks/useAuth";

/**
 * The phone navigation: three destinations within thumb reach and a fourth tab that opens the
 * menu sheet with everything else. One highlighter swipe sits behind the current page's icon and
 * glides to the next; the tabs are equal columns, so its place is the tab's index. Hidden from
 * `sm` up, where the top bar carries the same items.
 */
export default function PublicTabBar({
  menuOpened,
  onOpenMenu,
}: {
  menuOpened: boolean;
  onOpenMenu: () => void;
}) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { isLoggedIn } = useAuth();
  const tabs = primaryLinks(isLoggedIn);
  const activeIndex = tabs.findIndex((tab) => isActive(tab, pathname));

  return (
    <nav className={classes.tabBar} aria-label="Hovedmeny">
      <Box
        component="span"
        className={classes.tabMarker}
        data-visible={activeIndex === -1 ? undefined : ""}
        style={{ "--tab-index": Math.max(activeIndex, 0), "--tab-count": tabs.length + 1 }}
        aria-hidden
      />
      {tabs.map((tab) => {
        const active = isActive(tab, pathname);
        return (
          <TanStackAnchor
            key={tab.to}
            to={tab.to}
            className={classes.tab}
            underline="never"
            data-active={active || undefined}
            aria-current={active ? "page" : undefined}
          >
            <span className={classes.tabIcon}>
              <tab.icon size={24} stroke={active ? 2 : 1.6} aria-hidden />
            </span>
            {tab.label}
          </TanStackAnchor>
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
