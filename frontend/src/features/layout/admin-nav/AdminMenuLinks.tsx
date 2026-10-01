import { Collapse, UnstyledButton } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { useState } from "react";

import { visibleAdminNavSections } from "@/features/layout/admin-nav/adminNavigation";
import type { AdminNavGroup } from "@/features/layout/admin-nav/adminNavigation";
import { MenuRow, MenuRowContent, MenuSection } from "@/features/layout/nav/Menu";
import classes from "@/features/layout/nav/Nav.module.css";
import { isNavLinkActive, usePathname } from "@/features/layout/nav/navigation";
import useAuth from "@/shared/hooks/useAuth";

/**
 * Every page the employee may open, in sections, with the two long groups folded behind a row
 * that opens. The same list in the desktop sidebar and the phone menu sheet; the current page is
 * marked the way the navigation marks it everywhere: teal, with the highlighter under the word.
 */
export default function AdminMenuLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { isAdmin } = useAuth();
  return visibleAdminNavSections(isAdmin).map((section) => (
    <MenuSection key={section.label} title={section.label}>
      {section.links.map((link) => (
        <MenuRow key={link.to} link={link} onNavigate={onNavigate} />
      ))}
      {section.groups?.map((group) => (
        <FoldedGroup key={group.label} group={group} onNavigate={onNavigate} />
      ))}
    </MenuSection>
  ));
}

/** A group's pages behind one row; open from the start while one of them is the current page. */
function FoldedGroup({ group, onNavigate }: { group: AdminNavGroup; onNavigate?: () => void }) {
  const pathname = usePathname();
  const current = group.links.some((link) => isNavLinkActive(link, pathname));
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
        <MenuRowContent icon={group.icon} label={group.label} />
        <IconChevronRight className={classes.groupChevron} size={16} aria-hidden />
      </UnstyledButton>
      <Collapse expanded={opened}>
        <div className={classes.groupChildren}>
          {group.links.map((link) => (
            <MenuRow key={link.to} link={link} onNavigate={onNavigate} />
          ))}
        </div>
      </Collapse>
    </>
  );
}
