import Logo from "@/features/layout/Logo";
import classes from "@/features/layout/nav/Nav.module.css";

/**
 * The teal bar over bl-admin: the wordmark, which leads to the dashboard, in the same frame as the
 * public site's bar. The navigation itself is the sidebar on desktop and the tab bar on phones.
 */
export default function AdminTopBar() {
  return (
    <div className={classes.bar}>
      <Logo variant="white" admin />
    </div>
  );
}
