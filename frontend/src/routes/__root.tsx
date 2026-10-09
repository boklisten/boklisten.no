// Mantine's stylesheets go first in `links` so the app's own styles override them.
import mantineCoreStyles from "@mantine/core/styles.css?url";
import mantineDatesStyles from "@mantine/dates/styles.css?url";
import mantineScheduleStyles from "@mantine/schedule/styles.css?url";
import mantineNotificationsStyles from "@mantine/notifications/styles.css?url";
import mantineSpotlightStyles from "@mantine/spotlight/styles.css?url";
import mantineTiptapStyles from "@mantine/tiptap/styles.css?url";
import mantineChartsStyles from "@mantine/charts/styles.css?url";
import viewTransitionStyles from "@/styles/view-transitions.css?url";
import "@/shared/utils/dayjs";

import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";

import { authQueryOptions } from "@/features/auth/authQuery";
import theme, { cssVariablesResolver } from "@/shared/utils/theme";
import { jsonLdScript, urlDependentHead } from "@/shared/utils/seo";
import { organizationSchema, websiteSchema } from "@/shared/utils/structuredData";
import { DatesProvider } from "@mantine/dates";
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  /**
   * Who is logged in is settled before anything renders, on the server as well as in the
   * browser, so the first paint already shows the right buttons (see `authQueryOptions`).
   * When the API cannot answer, the page still renders, as for a guest; pages that need the
   * user retry from `AuthGuard` instead of every page failing.
   */
  beforeLoad: async ({ context }) => {
    await context.queryClient
      .query({ ...authQueryOptions(), staleTime: "static" })
      .catch(() => null);
  },
  head: (ctx) => {
    const { meta, links } = urlDependentHead(ctx);
    return {
      meta: [
        { charSet: "utf8" },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        },
        { title: "Boklisten.no" },
        ...meta,
      ],
      links: [
        ...[
          mantineCoreStyles,
          mantineDatesStyles,
          mantineScheduleStyles,
          mantineNotificationsStyles,
          mantineSpotlightStyles,
          mantineTiptapStyles,
          mantineChartsStyles,
          viewTransitionStyles,
        ].map((href) => ({ rel: "stylesheet", href })),
        ...links,
        // The wordmark and the front page's headlines are set in Fraunces.
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,600..700,50&display=swap",
        },
      ],
      scripts: [jsonLdScript(organizationSchema()), jsonLdScript(websiteSchema())],
    };
  },
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  // The devtools button would cover the phone tab bar; the tools are only offered on wider screens.
  const wide = useMediaQuery("(min-width: 48em)");
  return (
    <html lang="no" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
        <HeadContent />
      </head>
      <body>
        <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver}>
          <Notifications />
          <DatesProvider settings={{ locale: "nb" }}>
            <ModalsProvider>{children}</ModalsProvider>
            {wide && <ReactQueryDevtools />}
          </DatesProvider>
        </MantineProvider>
        <Scripts />
      </body>
    </html>
  );
}
