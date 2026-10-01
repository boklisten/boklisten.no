import { useId } from "react";

import { ADMIN_USER_SETTINGS } from "@/features/layout/adminNavigation";
import IdentityHead from "@/features/layout/nav/IdentityHead";
import classes from "@/features/layout/nav/Nav.module.css";
import ColorSchemeSelector from "@/features/user/ColorSchemeSelector";

/**
 * The top of the sidebar and the sheet: who is logged in, with the theme pill right under, so the
 * employee's own things sit together and the tools below stay within thumb reach.
 */
export default function AdminMenuHead({
  compact = false,
  onNavigate,
}: {
  /** In the narrow sidebar: smaller badge and a tighter theme pill. */
  compact?: boolean;
  onNavigate: () => void;
}) {
  const themeLabelId = useId();

  return (
    <div className={classes.menuHead}>
      <div className={classes.sheetHead}>
        <IdentityHead
          settingsTo={ADMIN_USER_SETTINGS.to}
          badge="permission"
          badgeSize={compact ? "xs" : "sm"}
          onNavigate={onNavigate}
        />
      </div>
      <div className={classes.menuTheme}>
        <div id={themeLabelId} className={classes.menuThemeLabel}>
          Utseende
        </div>
        <ColorSchemeSelector fullWidth compact={compact} labelledBy={themeLabelId} />
      </div>
    </div>
  );
}
