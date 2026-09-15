import useApiClient from "@/shared/hooks/useApiClient";
import BL_CONFIG from "@/shared/utils/bl-config";
import { hasPendingTasks } from "@/shared/utils/tasks";
import { useLocation, useNavigate } from "@tanstack/react-router";

/**
 * Where a user goes after logging in: the `redirect` search param, or the front page. The target
 * survives the detour through Vipps and the pending-tasks page in localStorage.
 */
export default function useLoginRedirect() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const { client } = useApiClient();

  function redirectToTarget() {
    const { localStorageKeys } = BL_CONFIG.login;

    const redirect = search.redirect ?? localStorage.getItem(localStorageKeys.redirect) ?? "";

    localStorage.removeItem(localStorageKeys.redirect);

    // The login/token page is a waypoint, not a destination: Back must skip it.
    void navigate({ to: `/${redirect}`, replace: true });
  }

  async function redirectAfterLogin() {
    let userDetail;
    try {
      userDetail = await client.api.userDetail.getMyDetails({});
    } catch {
      redirectToTarget();
      return;
    }
    if (hasPendingTasks(userDetail)) {
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
