import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import type { User } from "@boklisten/backend/shared/user";

import { apiClient } from "@/shared/utils/apiClient";

/**
 * Who is logged in, asked of the API while the page is rendered on the server. The browser's
 * cookies travel with the page request, so they are handed on to the API with this one call;
 * without a cookie there is nobody to look up.
 *
 * The cookies the API sets are handed back to the browser the same way: once the session has
 * expired, this call is the one that spends the remember-me token, and the browser must receive
 * its replacement or it is logged out.
 */
const fetchSessionUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<User | null> => {
    const { getRequestHeader, setResponseHeader } = await import("@tanstack/react-start/server");
    const cookie = getRequestHeader("cookie");
    if (!cookie) {
      return null;
    }
    const { user } = await apiClient.api.auth.me({
      headers: { cookie },
      hooks: {
        afterResponse: [
          (_request, _options, response) => {
            const setCookies = response.headers.getSetCookie();
            if (setCookies.length > 0) {
              setResponseHeader("set-cookie", setCookies);
            }
          },
        ],
      },
    });
    return user;
  },
);

async function fetchUser(): Promise<User | null> {
  const { user } = await apiClient.api.auth.me({});
  return user;
}

/** Prefix key for invalidating the auth query after anything that changes the user's tasks. */
export function authQueryKey() {
  return ["auth", "me"] as const;
}

/**
 * The logged-in user, or null for a guest: the one query every "logged in or not" decision reads.
 * The root route fills it before the first render, so server-rendered pages already show the
 * right buttons and nothing flips after hydration.
 */
export function authQueryOptions() {
  return queryOptions({
    queryKey: authQueryKey(),
    queryFn: () => (typeof window === "undefined" ? fetchSessionUser() : fetchUser()),
  });
}
