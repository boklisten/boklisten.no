import type { UserPermission } from "@boklisten/backend/shared/user-permission";
import { Button, Stack } from "@mantine/core";
import { Activity, type ReactNode, useEffect, useEffectEvent } from "react";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import useAuth from "@/shared/hooks/useAuth";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";

const PATHS_ALLOWED_WITH_PENDING_TASKS = ["oppgaver", "user-settings", "logout"];

/**
 *
 * Ensures that a user is logged in and optionally has the correct permission level
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
  const { isLoading, isLoggedIn, canAccess } = useAuth();
  const { api } = useApiClient();

  const isPermitted = isLoggedIn && (!requiredPermission || canAccess(requiredPermission));

  const {
    data: userDetail,
    errorUpdateCount,
    isFetching,
    refetch,
  } = useQuery({
    ...api.userDetail.getMyDetails.queryOptions(),
    enabled: !isLoading && isPermitted,
  });

  const hasPendingTasks =
    (userDetail?.tasks?.confirmDetails || userDetail?.tasks?.signAgreement) ?? false;
  const isOnAllowedPath = PATHS_ALLOWED_WITH_PENDING_TASKS.some((allowed) =>
    pathname.includes(allowed),
  );

  const onAuthChange = useEffectEvent(() => {
    if (!isLoggedIn) {
      void navigate({ to: "/auth/login", search: { redirect: pathname.slice(1) } });
      return;
    }

    if (requiredPermission && !canAccess(requiredPermission)) {
      void navigate({ to: "/auth/permission/denied" });
      return;
    }

    if (hasPendingTasks && !isOnAllowedPath) {
      void navigate({ to: "/oppgaver", search: { redirect: pathname.slice(1) } });
    }
  });

  useEffect(() => {
    if (isLoading) return;
    onAuthChange();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- the extra deps deliberately re-run the auth check whenever the auth state changes
  }, [isLoading, isLoggedIn, requiredPermission, hasPendingTasks, isOnAllowedPath]);

  if (errorUpdateCount > 0 && userDetail === undefined) {
    return (
      <Stack align={"center"}>
        <ErrorAlert title={"Klarte ikke laste inn brukeren din"}>
          {PLEASE_TRY_AGAIN_TEXT}
        </ErrorAlert>
        <Button loading={isFetching} onClick={() => void refetch()}>
          Prøv igjen
        </Button>
      </Stack>
    );
  }

  const isAuthenticated =
    isPermitted && userDetail !== undefined && !(hasPendingTasks && !isOnAllowedPath);

  return <Activity mode={isAuthenticated ? "visible" : "hidden"}>{children}</Activity>;
}
