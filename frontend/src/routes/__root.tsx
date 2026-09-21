import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/schedule/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/spotlight/styles.css";
import "@mantine/tiptap/styles.css";
import "@mantine/charts/styles.css";
import "@/styles/view-transitions.css";
import "@/shared/utils/dayjs";

import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";

import { authQueryOptions } from "@/features/auth/authQuery";
import theme, { cssVariablesResolver } from "@/shared/utils/theme";
import { jsonLdScript, urlDependentHead } from "@/shared/utils/seo";
import { organizationSchema, websiteSchema } from "@/shared/utils/structuredData";
import { DatesProvider } from "@mantine/dates";
import type { QueryClient } from "@tanstack/react-query";
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
      links,
      scripts: [jsonLdScript(organizationSchema()), jsonLdScript(websiteSchema())],
    };
  },
  component: RootLayout,
});

function RootLayout() {
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
            <ModalsProvider>
              <Outlet />
              <Scripts />
            </ModalsProvider>
            <ReactQueryDevtools />
          </DatesProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
