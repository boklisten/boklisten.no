import AdminMenuFoot from "@/features/layout/admin-nav/AdminMenuFoot";
import AdminMenuLinks from "@/features/layout/admin-nav/AdminMenuLinks";
import { ADMIN_USER_SETTINGS } from "@/features/layout/adminNavigation";
import IdentityHead from "@/features/layout/nav/IdentityHead";
import MenuSheet from "@/features/layout/nav/MenuSheet";
import classes from "@/features/layout/nav/Nav.module.css";

/** bl-admin's menu on phones: the sidebar's content, risen from the tab bar. */
export default function AdminMenuSheet({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  return (
    <MenuSheet opened={opened} onClose={onClose}>
      <div className={classes.sheetHead}>
        <IdentityHead settingsTo={ADMIN_USER_SETTINGS.to} onNavigate={onClose} />
      </div>
      <AdminMenuLinks onNavigate={onClose} />
      <AdminMenuFoot onNavigate={onClose} />
    </MenuSheet>
  );
}
