import { ScrollArea } from "@mantine/core";

import AdminMenuHead from "@/features/layout/admin-nav/AdminMenuHead";
import AdminMenuLinks from "@/features/layout/admin-nav/AdminMenuLinks";
import classes from "@/features/layout/nav/Nav.module.css";

/** The desktop sidebar: the phone menu sheet, standing. */
export default function AdminPageNavigation() {
  return (
    <div className={classes.sidebar}>
      <AdminMenuHead compact onNavigate={noop} />
      <ScrollArea className={classes.sidebarScroll} type="auto">
        <AdminMenuLinks onNavigate={noop} />
      </ScrollArea>
    </div>
  );
}

function noop() {
  // The sidebar stays open; nothing to close on navigation.
}
