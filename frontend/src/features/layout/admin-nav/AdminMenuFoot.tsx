import LogoutButton from "@/features/layout/nav/LogoutButton";
import classes from "@/features/layout/nav/Nav.module.css";

/** The way out of bl-admin, behind a hairline at the foot of the sidebar and the sheet. */
export default function AdminMenuFoot({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className={`${classes.group} ${classes.menuFoot}`}>
      <LogoutButton onNavigate={onNavigate} />
    </div>
  );
}
