import {
  Alert,
  Anchor,
  Button,
  CloseButton,
  DrawerBody,
  DrawerContent,
  DrawerOverlay,
  DrawerRoot,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconAlertCircle, IconLogout } from "@tabler/icons-react";
import { useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

import CustomerAvatar from "@/features/customer-search/CustomerAvatar";
import {
  BOOK_LINKS,
  firstName,
  INFO_LINKS,
  isActive,
  USER_SETTINGS,
} from "@/features/layout/public-nav/publicNavigation";
import type { PublicNavLink } from "@/features/layout/public-nav/publicNavigation";
import classes from "@/features/layout/public-nav/PublicNav.module.css";
import { openCustomerIdModal } from "@/shared/components/ShowCustomerIdButton";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import useAuth from "@/shared/hooks/useAuth";
import { countPendingTasks } from "@/shared/utils/tasks";

/**
 * The menu: on phones a sheet that rises from the tab bar, on desktop a drawer from the right,
 * with the same content. It opens on who is logged in, then lists the pages in two groups. A
 * guest gets the two ways in instead of the account block.
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
  // The drawer only ever opens after hydration, so the first (phone) value never paints.
  const wide = useMediaQuery("(min-width: 48em)");

  return (
    <DrawerRoot
      opened={opened}
      onClose={onClose}
      position={wide ? "right" : "bottom"}
      size={wide ? 380 : "auto"}
      scrollAreaComponent={wide ? undefined : NaturalHeight}
    >
      <DrawerOverlay backgroundOpacity={0.35} blur={2} />
      <DrawerContent
        classNames={{
          content: wide ? classes.sheetContent : `${classes.sheetContent} ${classes.bottom}`,
        }}
      >
        <DrawerBody className={classes.sheetBody}>
          <div className={classes.sheetHead}>
            {user ? (
              <div className={classes.identity}>
                <CustomerAvatar userId={user.id} />
                <div className={classes.identityText}>
                  <div className={classes.identityName}>{firstName(user)}</div>
                  <div className={classes.identityMeta}>
                    <Anchor
                      component="button"
                      type="button"
                      className={classes.identityAction}
                      onClick={() => {
                        openCustomerIdModal(user.id);
                      }}
                    >
                      Vis kunde-ID
                    </Anchor>
                    <TanStackAnchor
                      to={USER_SETTINGS.to}
                      className={classes.identityAction}
                      onClick={onClose}
                    >
                      {USER_SETTINGS.label}
                    </TanStackAnchor>
                  </div>
                </div>
              </div>
            ) : (
              <div className={classes.identityName}>Meny</div>
            )}
            <CloseButton
              className={classes.sheetClose}
              size="lg"
              onClick={onClose}
              aria-label="Lukk meny"
            />
          </div>

          {!isLoggedIn && (
            <div className={classes.guest}>
              <Button component={TanStackAnchor} to="/auth/login" onClick={onClose}>
                Logg inn
              </Button>
              <Button
                component={TanStackAnchor}
                to="/auth/register"
                variant="outline"
                onClick={onClose}
              >
                Registrer
              </Button>
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

          <div className={classes.sheetFoot}>
            {isLoggedIn && (
              <Button
                component={TanStackAnchor}
                to="/auth/logout"
                variant="subtle"
                color="red"
                fullWidth
                leftSection={<IconLogout size={18} />}
                onClick={onClose}
              >
                Logg ut
              </Button>
            )}
          </div>
        </DrawerBody>
      </DrawerContent>
    </DrawerRoot>
  );
}

/** Mantine wraps the drawer body in a full-viewport-height scroller; the sheet keeps its own height. */
function NaturalHeight({ children }: { children: ReactNode }) {
  return children;
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
  const active = isActive(link, pathname);
  return (
    <TanStackAnchor
      to={link.to}
      className={classes.row}
      underline="never"
      data-active={active || undefined}
      aria-current={active ? "page" : undefined}
      onClick={onClose}
    >
      <span className={classes.rowIcon}>
        <link.icon size={22} stroke={1.7} aria-hidden />
      </span>
      <span className={classes.rowText}>
        <span className={classes.rowLabel}>{link.label}</span>
        {link.description && <span className={classes.rowDescription}>{link.description}</span>}
      </span>
    </TanStackAnchor>
  );
}
