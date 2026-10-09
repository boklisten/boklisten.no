import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";

import { authQueryOptions } from "@/features/auth/authQuery";
import { hasPendingTasks } from "@/shared/utils/tasks";

/**
 * Where a user goes after logging in: the `redirect` search param (a path without its leading
 * slash), or the front page. The pending-tasks page carries the param along.
 */
export default function useLoginRedirect() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  function redirectToTarget() {
    // The login page is a waypoint, not a destination: Back must skip it.
    void navigate({ to: `/${search.redirect ?? ""}`, replace: true });
  }

  async function redirectAfterLogin() {
    let user;
    try {
      user = await queryClient.query(authQueryOptions());
    } catch {
      redirectToTarget();
      return;
    }
    if (hasPendingTasks(user)) {
      void navigate({ to: "/oppgaver", search: { redirect: search.redirect } });
    } else {
      redirectToTarget();
    }
  }

  return { redirectToTarget, redirectAfterLogin };
}
