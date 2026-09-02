import useApiClient from "@/shared/hooks/useApiClient";
import useAuth, { login } from "@/shared/hooks/useAuth";
import BL_CONFIG from "@/shared/utils/bl-config";
import { publicApiClient } from "@/shared/utils/publicApiClient";
import { hasPendingTasks } from "@/shared/utils/tasks";
import { useLocation, useNavigate } from "@tanstack/react-router";

export default function useAuthLinker() {
  const { search, searchStr } = useLocation();
  const navigate = useNavigate();
  const { isLoading, isLoggedIn } = useAuth();
  const { client } = useApiClient();

  async function redirectToBlAdmin(path: string, retainHistory?: boolean) {
    if (isLoading) {
      return;
    }

    const url = new URL(`${import.meta.env["VITE_BL_ADMIN_URL"]}/${path}${searchStr}`);

    if (isLoggedIn) {
      // The stored access token may predate a permission change (tokens live for a
      // year), and bl-admin trusts the permission embedded in it. Re-mint the tokens
      // so the hand-off carries the user's current permission — otherwise a newly
      // promoted employee is bounced between login and bl-admin indefinitely.
      const storedRefreshToken = localStorage.getItem(BL_CONFIG.token.refreshToken);
      if (storedRefreshToken) {
        try {
          const freshTokens = await publicApiClient.api.tokens.token({
            body: { refreshToken: storedRefreshToken },
          });
          if (freshTokens) {
            login(freshTokens);
          }
        } catch {
          // Fall back to the stored tokens
        }
      }
      const accessToken = localStorage.getItem(BL_CONFIG.token.accessToken);
      const refreshToken = localStorage.getItem(BL_CONFIG.token.refreshToken);
      if (accessToken && refreshToken) {
        url.searchParams.append("refresh_token", refreshToken);
        url.searchParams.append("access_token", accessToken);
      }
    }
    void navigate({ href: url.toString(), replace: !retainHistory });
  }

  function redirectToCaller() {
    const { localStorageKeys } = BL_CONFIG.login;

    const caller = search.caller ?? localStorage.getItem(localStorageKeys.caller);

    const redirect = search.redirect ?? localStorage.getItem(localStorageKeys.redirect) ?? "";

    localStorage.removeItem(localStorageKeys.caller);
    localStorage.removeItem(localStorageKeys.redirect);

    if (!caller) {
      // The login/token page is a waypoint, not a destination: Back must skip it.
      void navigate({ to: `/${redirect}`, replace: true });
      return;
    }

    if (caller !== "bl-admin") {
      throw new Error("Invalid caller");
    }
    void redirectToBlAdmin(`auth/gateway?redirect=${redirect}`);
  }

  async function redirectAfterLogin() {
    let userDetail;
    try {
      userDetail = await client.api.userDetail.getMyDetails({});
    } catch {
      redirectToCaller();
      return;
    }
    if (hasPendingTasks(userDetail)) {
      // Persist caller/redirect so the handoff survives the detour to /oppgaver
      const { localStorageKeys } = BL_CONFIG.login;
      if (search.caller) {
        localStorage.setItem(localStorageKeys.caller, search.caller);
      }
      if (search.redirect) {
        localStorage.setItem(localStorageKeys.redirect, search.redirect);
      }
      void navigate({ to: "/oppgaver" });
    } else {
      redirectToCaller();
    }
  }

  return { redirectToBlAdmin, redirectToCaller, redirectAfterLogin };
}
