import * as Sentry from "@sentry/tanstackstart-react";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { TuyauHTTPError } from "@tuyau/core/client";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { routeTree } from "@/routeTree.gen";
import { authQueryOptions } from "@/features/auth/authQuery";
import ErrorBoundary from "@/features/layout/ErrorBoundary";
import NotFoundPage from "@/features/NotFoundPage";

/** Anything can be thrown; the error page and Sentry want an Error with a name, message and stack. */
function asError(thrown: unknown): Error {
  return thrown instanceof Error ? thrown : new Error(String(thrown));
}

function isAuthError(error: unknown, status: 401 | 403): boolean {
  return error instanceof TuyauHTTPError && error.isStatus(status);
}

export function getRouter() {
  /**
   * A 401 means the session ended while the page was open (logged out elsewhere, expired,
   * revoked): forget the user and go to the login page. A 403 is a permission the user lacks.
   */
  function onRequestError(error: unknown) {
    if (typeof window === "undefined") {
      return;
    }
    if (isAuthError(error, 401)) {
      queryClient.setQueryData(authQueryOptions().queryKey, null);
      void router.navigate({
        to: "/auth/login",
        search: { redirect: window.location.pathname.slice(1) },
      });
    } else if (isAuthError(error, 403)) {
      void router.navigate({ to: "/auth/permission/denied" });
    }
  }

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: (failureCount, error) =>
          failureCount < 3 && !isAuthError(error, 401) && !isAuthError(error, 403),
      },
    },
    queryCache: new QueryCache({ onError: onRequestError }),
    mutationCache: new MutationCache({ onError: onRequestError }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultErrorComponent: ({ error }) => (
      <ErrorBoundary error={asError(error)} withLogo href="/" />
    ),
    defaultNotFoundComponent: NotFoundPage,
  });

  setupRouterSsrQueryIntegration({ router, queryClient });

  if (!router.isServer && !import.meta.env.DEV) {
    Sentry.init({
      dsn: "https://6ffc45d40e73d726fff078a70929a634@o569888.ingest.us.sentry.io/4508654849294336",
      integrations: [
        Sentry.tanstackRouterBrowserTracingIntegration(router),
        Sentry.replayIntegration(),
        Sentry.feedbackIntegration({
          colorScheme: "system",
          autoInject: !window.matchMedia("(max-width: 48em)").matches,
        }),
      ],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1,
    });
  }
  return router;
}
