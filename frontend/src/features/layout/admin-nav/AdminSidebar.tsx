import { ScrollArea } from "@mantine/core";

import AdminMenuLinks from "@/features/layout/admin-nav/AdminMenuLinks";
import { ADMIN_USER_SETTINGS } from "@/features/layout/admin-nav/adminNavigation";
import IdentityHead from "@/features/layout/nav/IdentityHead";
import classes from "@/features/layout/nav/Nav.module.css";

/**
 * The desktop sidebar: the phone menu sheet, standing. "Din bruker" stays put above the scrolling
 * list, with a smaller chip so it fits beside the avatar.
 */
export default function AdminSidebar() {
  return (
    <div className={classes.sidebar}>
      <div className={classes.sidebarHead}>
        <IdentityHead settingsTo={ADMIN_USER_SETTINGS.to} site="admin" badgeSize="xs" />
      </div>
      <ScrollArea className={classes.sidebarScroll} type="auto">
        <AdminMenuLinks />
      </ScrollArea>
    </div>
  );
}
