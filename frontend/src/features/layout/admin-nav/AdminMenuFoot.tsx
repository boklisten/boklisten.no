import { IconLogout } from "@tabler/icons-react";

import { MenuRow } from "@/features/layout/nav/MenuSheet";
import classes from "@/features/layout/nav/Nav.module.css";

/** The way out of bl-admin, behind a hairline at the foot of the sidebar and the sheet. */
export default function AdminMenuFoot({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className={`${classes.group} ${classes.menuFoot}`}>
      <MenuRow
        label="Logg ut"
        to="/auth/logout"
        icon={IconLogout}
        active={false}
        tone="danger"
        onNavigate={onNavigate}
      />
    </div>
  );
}
