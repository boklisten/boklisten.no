import type { UserPermission } from "@boklisten/backend/shared/user-permission";
import { Button, Stack } from "@mantine/core";
import { Activity, useEffect, useEffectEvent } from "react";
import type { ReactNode } from "react";

import { authQueryOptions } from "@/features/auth/authQuery";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useAuth from "@/shared/hooks/useAuth";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";

import { hasPendingTasks } from "@/shared/utils/tasks";

const PATHS_ALLOWED_WITH_PENDING_TASKS = ["oppgaver", "user-settings", "logout"];

/**
 * Ensures that a user is logged in and optionally has the correct permission level, and sends
 * customers with pending tasks to complete them first.
 */
export default function AuthGuard({
  children,
  requiredPermission,
}: {
  children: ReactNode;
  requiredPermission?: UserPermission;
}) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const { user, isLoggedIn, canAccess } = useAuth();
  const { data, errorUpdateCount, isFetching, refetch } = useQuery(authQueryOptions());

  const isPermitted = isLoggedIn && (!requiredPermission || canAccess(requiredPermission));
  const pendingTasks = hasPendingTasks(user);
  const isOnAllowedPath = PATHS_ALLOWED_WITH_PENDING_TASKS.some((allowed) =>
    pathname.includes(allowed),
  );
  // Never answered (a guest answers with null); errorUpdateCount alone stays up after a retry succeeds.
  const isUnresolved = data === undefined && errorUpdateCount > 0;

  const onAuthChange = useEffectEvent(() => {
    if (!isLoggedIn) {
      void navigate({ to: "/auth/login", search: { redirect: pathname.slice(1) } });
      return;
    }

    if (requiredPermission && !canAccess(requiredPermission)) {
      void navigate({ to: "/auth/permission/denied" });
      return;
    }

    if (pendingTasks && !isOnAllowedPath) {
      void navigate({ to: "/oppgaver", search: { redirect: pathname.slice(1) } });
    }
  });

  useEffect(() => {
    // A failed lookup is not a guest: offer a retry instead of bouncing to the login page.
    if (isUnresolved) {
      return;
    }
    onAuthChange();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- the extra deps deliberately re-run the auth check whenever the auth state changes
  }, [isUnresolved, isLoggedIn, requiredPermission, pendingTasks, isOnAllowedPath]);

  if (isUnresolved) {
    return (
      <Stack align="center">
        <ErrorAlert title="Klarte ikke laste inn brukeren din">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
        <Button loading={isFetching} onClick={() => void refetch()}>
          Prøv igjen
        </Button>
      </Stack>
    );
  }

  const isAuthenticated = isPermitted && !(pendingTasks && !isOnAllowedPath);

  return <Activity mode={isAuthenticated ? "visible" : "hidden"}>{children}</Activity>;
}
