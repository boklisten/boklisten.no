import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";

import { authQueryOptions } from "@/features/auth/authQuery";
import BL_CONFIG from "@/shared/utils/bl-config";
import { hasPendingTasks } from "@/shared/utils/tasks";

/**
 * Where a user goes after logging in: the `redirect` search param, or the front page. The target
 * survives the detour through Vipps and the pending-tasks page in localStorage.
 */
export default function useLoginRedirect() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  function redirectToTarget() {
    const { localStorageKeys } = BL_CONFIG.login;

    const redirect = search.redirect ?? localStorage.getItem(localStorageKeys.redirect) ?? "";

    localStorage.removeItem(localStorageKeys.redirect);

    // The login page is a waypoint, not a destination: Back must skip it.
    void navigate({ to: `/${redirect}`, replace: true });
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
      // Persist the target so the redirect survives the detour to /oppgaver
      if (search.redirect) {
        localStorage.setItem(BL_CONFIG.login.localStorageKeys.redirect, search.redirect);
      }
      void navigate({ to: "/oppgaver" });
    } else {
      redirectToTarget();
    }
  }

  return { redirectToTarget, redirectAfterLogin };
}
