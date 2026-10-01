import { useLocation } from "@tanstack/react-router";

import { ADMIN_PRIMARY_LINKS, isAdminNavLinkActive } from "@/features/layout/adminNavigation";
import TabBar from "@/features/layout/nav/TabBar";

/** bl-admin's tab bar: the three everyday tools and the menu. */
export default function AdminTabBar({
  menuOpened,
  onOpenMenu,
}: {
  menuOpened: boolean;
  onOpenMenu: () => void;
}) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const tabs = ADMIN_PRIMARY_LINKS.map((link) => ({
    label: link.label,
    to: link.to,
    icon: link.icon,
    active: isAdminNavLinkActive(link, pathname),
  }));

  return <TabBar tabs={tabs} menuOpened={menuOpened} onOpenMenu={onOpenMenu} />;
}
