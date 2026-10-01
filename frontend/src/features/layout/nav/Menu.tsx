import type { Icon } from "@tabler/icons-react";
import type { ReactNode } from "react";

import NavAnchor from "@/features/layout/nav/NavAnchor";
import classes from "@/features/layout/nav/Nav.module.css";
import { isNavLinkActive, usePathname } from "@/features/layout/nav/navigation";
import type { NavLink } from "@/features/layout/nav/navigation";

/** One block of a menu, in the sheet and the sidebar alike: a title and what it holds. */
export function MenuSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={classes.group}>
      <p className={classes.groupTitle}>{title}</p>
      {children}
    </div>
  );
}

/** One page in the menu, marked while it (or a page below it) is open. */
export function MenuRow({ link, onNavigate }: { link: NavLink; onNavigate?: () => void }) {
  const active = isNavLinkActive(link, usePathname());
  return (
    <NavAnchor to={link.to} active={active} className={classes.row} onClick={onNavigate}>
      <MenuRowContent icon={link.icon} label={link.label} hint={link.hint} />
    </NavAnchor>
  );
}

/** A row's icon, name and, for a name that does not say what the page does, one line more. */
export function MenuRowContent({
  icon: RowIcon,
  label,
  hint,
}: {
  icon: Icon;
  label: string;
  hint?: string;
}) {
  return (
    <>
      <span className={classes.rowIcon}>
        <RowIcon size={22} stroke={1.7} aria-hidden />
      </span>
      <span className={classes.rowText}>
        <span className={classes.rowLabel}>{label}</span>
        {hint && <span className={classes.rowHint}>{hint}</span>}
      </span>
    </>
  );
}
