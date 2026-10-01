import AdminMenuFoot from "@/features/layout/admin-nav/AdminMenuFoot";
import AdminMenuHead from "@/features/layout/admin-nav/AdminMenuHead";
import AdminMenuLinks from "@/features/layout/admin-nav/AdminMenuLinks";
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
      <AdminMenuHead onNavigate={onClose} />
      <AdminMenuLinks onNavigate={onClose} />
      <AdminMenuFoot onNavigate={onClose} />
    </MenuSheet>
  );
}
