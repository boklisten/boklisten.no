import { Alert } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useLocation } from "@tanstack/react-router";

import IdentityHead from "@/features/layout/nav/IdentityHead";
import LogoutButton from "@/features/layout/nav/LogoutButton";
import MenuSheet, { MenuRow } from "@/features/layout/nav/MenuSheet";
import classes from "@/features/layout/nav/Nav.module.css";
import {
  BOOK_LINKS,
  INFO_LINKS,
  isActive,
  USER_SETTINGS,
} from "@/features/layout/public-nav/publicNavigation";
import type { PublicNavLink } from "@/features/layout/public-nav/publicNavigation";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import TanStackButton from "@/shared/components/TanStackButton";
import useAuth from "@/shared/hooks/useAuth";
import { countPendingTasks } from "@/shared/utils/tasks";

/**
 * The public menu. It opens on who is logged in, then lists the pages in two groups. A guest gets
 * the two ways in instead of the account block.
 */
export default function PublicMenuSheet({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { user, isLoggedIn } = useAuth();
  const taskCount = countPendingTasks(user);

  return (
    <MenuSheet opened={opened} onClose={onClose}>
      <div className={classes.sheetHead}>
        <IdentityHead settingsTo={USER_SETTINGS.to} badge="branch" onNavigate={onClose} />
      </div>

      {!isLoggedIn && (
        <div className={classes.guest}>
          <TanStackButton to="/auth/login" onClick={onClose}>
            Logg inn
          </TanStackButton>
          <TanStackButton to="/auth/register" variant="outline" onClick={onClose}>
            Registrer
          </TanStackButton>
        </div>
      )}

      {taskCount > 0 && (
        <Alert
          className={classes.tasks}
          color="red"
          variant="light"
          icon={<IconAlertCircle />}
          title={taskCount === 1 ? "Du har en oppgave" : `Du har ${taskCount} oppgaver`}
        >
          <TanStackAnchor to="/oppgaver" c="red" fw={600} onClick={onClose}>
            Fullfør oppgavene dine
          </TanStackAnchor>
        </Alert>
      )}

      <div className={classes.group}>
        <p className={classes.groupTitle}>{isLoggedIn ? "Bøkene dine" : "Bøker"}</p>
        {BOOK_LINKS.filter((link) => isLoggedIn || !link.loggedInOnly).map((link) => (
          <Row key={link.to} link={link} pathname={pathname} onClose={onClose} />
        ))}
      </div>

      <div className={classes.group}>
        <p className={classes.groupTitle}>Informasjon</p>
        {INFO_LINKS.map((link) => (
          <Row key={link.to} link={link} pathname={pathname} onClose={onClose} />
        ))}
      </div>

      <div className={classes.sheetFoot}>{isLoggedIn && <LogoutButton onNavigate={onClose} />}</div>
    </MenuSheet>
  );
}

function Row({
  link,
  pathname,
  onClose,
}: {
  link: PublicNavLink;
  pathname: string;
  onClose: () => void;
}) {
  return (
    <MenuRow
      label={link.label}
      to={link.to}
      icon={link.icon}
      description={link.description}
      active={isActive(link, pathname)}
      onNavigate={onClose}
    />
  );
}
