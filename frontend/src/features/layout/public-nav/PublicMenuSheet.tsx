import { Alert } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";

import IdentityHead from "@/features/layout/nav/IdentityHead";
import { MenuRow, MenuSection } from "@/features/layout/nav/Menu";
import MenuSheet from "@/features/layout/nav/MenuSheet";
import classes from "@/features/layout/nav/Nav.module.css";
import {
  BOOK_LINKS,
  INFO_LINKS,
  USER_SETTINGS,
} from "@/features/layout/public-nav/publicNavigation";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import TanStackButton from "@/shared/components/TanStackButton";
import useAuth from "@/shared/hooks/useAuth";
import { countPendingTasks } from "@/shared/utils/tasks";

/**
 * The public menu: three sections of one shape. "Din bruker" holds who is logged in and their
 * pending tasks, or a guest's two ways in; then the pages in two groups. Logging out lives on the
 * settings page.
 */
export default function PublicMenuSheet({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const { user, isLoggedIn } = useAuth();
  const taskCount = countPendingTasks(user);

  return (
    <MenuSheet opened={opened} onClose={onClose}>
      <IdentityHead
        settingsTo={USER_SETTINGS.to}
        site="public"
        onNavigate={onClose}
        guest={
          <div className={classes.guest}>
            <TanStackButton to="/auth/login" onClick={onClose}>
              Logg inn
            </TanStackButton>
            <TanStackButton to="/auth/register" variant="outline" onClick={onClose}>
              Registrer
            </TanStackButton>
          </div>
        }
      >
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
      </IdentityHead>

      <MenuSection title={isLoggedIn ? "Bøkene dine" : "Bøker"}>
        {BOOK_LINKS.filter((link) => isLoggedIn || !link.loggedInOnly).map((link) => (
          <MenuRow key={link.to} link={link} onNavigate={onClose} />
        ))}
      </MenuSection>

      <MenuSection title="Informasjon">
        {INFO_LINKS.map((link) => (
          <MenuRow key={link.to} link={link} onNavigate={onClose} />
        ))}
      </MenuSection>
    </MenuSheet>
  );
}
