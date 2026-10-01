import { Collapse, UnstyledButton } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";
import { useLocation } from "@tanstack/react-router";
import { useState } from "react";

import { isAdminNavLinkActive, visibleAdminNavSections } from "@/features/layout/adminNavigation";
import type { AdminNavLink } from "@/features/layout/adminNavigation";
import { MenuRow } from "@/features/layout/nav/MenuSheet";
import classes from "@/features/layout/nav/Nav.module.css";
import useAuth from "@/shared/hooks/useAuth";

/**
 * Every page the employee may open, in sections, with the two long groups folded behind a row
 * that opens. The same list in the desktop sidebar and the phone menu sheet; the current page is
 * marked the way the navigation marks it everywhere: teal, with the highlighter under the word.
 */
export default function AdminMenuLinks({ onNavigate }: { onNavigate: () => void }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { isAdmin } = useAuth();
  return visibleAdminNavSections(isAdmin).map((section) => (
    <div key={section.label} className={classes.group}>
      <p className={classes.groupTitle}>{section.label}</p>
      {section.links.map((link) => (
        <AdminMenuRow key={link.to} link={link} pathname={pathname} onNavigate={onNavigate} />
      ))}
      {section.groups?.map((group) => (
        <FoldedGroup
          key={group.label}
          label={group.label}
          icon={group.icon}
          links={group.links}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  ));
}

export function AdminMenuRow({
  link,
  pathname,
  onNavigate,
}: {
  link: AdminNavLink;
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <MenuRow
      label={link.label}
      to={link.to}
      icon={link.icon}
      active={isAdminNavLinkActive(link, pathname)}
      onNavigate={onNavigate}
    />
  );
}

/** A group's pages behind one row; open from the start while one of them is the current page. */
function FoldedGroup({
  label,
  icon: GroupIcon,
  links,
  pathname,
  onNavigate,
}: {
  label: string;
  icon: Icon;
  links: AdminNavLink[];
  pathname: string;
  onNavigate: () => void;
}) {
  const current = links.some((link) => isAdminNavLinkActive(link, pathname));
  const [chosen, setChosen] = useState<boolean | null>(null);
  const opened = chosen ?? current;
  return (
    <>
      <UnstyledButton
        className={`${classes.row} ${classes.groupRow}`}
        onClick={() => {
          setChosen(!opened);
        }}
        aria-expanded={opened}
        data-current={current || undefined}
      >
        <span className={classes.rowIcon}>
          <GroupIcon size={22} stroke={1.7} aria-hidden />
        </span>
        <span className={classes.rowText}>
          <span className={classes.rowLabel}>{label}</span>
        </span>
        <IconChevronRight className={classes.groupChevron} size={16} aria-hidden />
      </UnstyledButton>
      <Collapse expanded={opened}>
        <div className={classes.groupChildren}>
          {links.map((link) => (
            <AdminMenuRow key={link.to} link={link} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      </Collapse>
    </>
  );
}
