import { ScrollArea } from "@mantine/core";

import AdminMenuFoot from "@/features/layout/admin-nav/AdminMenuFoot";
import AdminMenuLinks from "@/features/layout/admin-nav/AdminMenuLinks";
import { ADMIN_USER_SETTINGS } from "@/features/layout/adminNavigation";
import IdentityHead from "@/features/layout/nav/IdentityHead";
import classes from "@/features/layout/nav/Nav.module.css";

/** The desktop sidebar: the phone menu sheet, standing. */
export default function AdminPageNavigation() {
  return (
    <div className={classes.sidebar}>
      <div className={classes.sheetHead}>
        <IdentityHead settingsTo={ADMIN_USER_SETTINGS.to} badgeSize="xs" onNavigate={noop} />
      </div>
      <ScrollArea className={classes.sidebarScroll} type="auto">
        <AdminMenuLinks onNavigate={noop} />
      </ScrollArea>
      <AdminMenuFoot onNavigate={noop} />
    </div>
  );
}

function noop() {
  // The sidebar stays open; nothing to close on navigation.
}
