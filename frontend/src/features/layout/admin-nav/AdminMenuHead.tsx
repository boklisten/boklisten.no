import { ADMIN_USER_SETTINGS } from "@/features/layout/adminNavigation";
import IdentityHead from "@/features/layout/nav/IdentityHead";
import classes from "@/features/layout/nav/Nav.module.css";

/**
 * The top of the sidebar and the sheet: who is logged in, the way to their own settings (where the
 * theme and logging out live too), so the tools below stay within thumb reach.
 */
export default function AdminMenuHead({
  compact = false,
  onNavigate,
}: {
  /** In the narrow sidebar: a smaller badge. */
  compact?: boolean;
  onNavigate: () => void;
}) {
  return (
    <div className={classes.menuHead}>
      <IdentityHead
        settingsTo={ADMIN_USER_SETTINGS.to}
        site="admin"
        badgeSize={compact ? "xs" : "sm"}
        onNavigate={onNavigate}
      />
    </div>
  );
}
