import AdminMenuLinks from "@/features/layout/admin-nav/AdminMenuLinks";
import { ADMIN_USER_SETTINGS } from "@/features/layout/admin-nav/adminNavigation";
import IdentityHead from "@/features/layout/nav/IdentityHead";
import MenuSheet from "@/features/layout/nav/MenuSheet";

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
      <IdentityHead settingsTo={ADMIN_USER_SETTINGS.to} site="admin" onNavigate={onClose} />
      <AdminMenuLinks onNavigate={onClose} />
    </MenuSheet>
  );
}
