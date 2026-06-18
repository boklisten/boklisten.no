import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/tiptap/styles.css";
import "@mantine/charts/styles.css";
import "mantine-react-table/styles.css";

import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";

import theme from "@/shared/utils/theme";
import { DatesProvider } from "@mantine/dates";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

export const rootQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
    },
  },
});

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      { title: "Boklisten.no" },
    ],
    scripts: [
      {
        src: "https://checkout.vipps.no/checkout-button/v1/vipps-checkout-button.js",
      },
      {
        src: "https://checkout.vipps.no/vippsCheckoutSDK.js",
      },
    ],
  }),
  component: RootLayout,
});

function RootLayout() {
  dayjs.extend(customParseFormat);
  dayjs.locale("nb");
  return (
    <html lang="no" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
        <HeadContent />
      </head>
      <body>
        <MantineProvider theme={theme}>
          <Notifications />
          <DatesProvider settings={{ locale: "nb" }}>
            <QueryClientProvider client={rootQueryClient}>
              <ModalsProvider>
                <Outlet />
                <Scripts />
              </ModalsProvider>
              <ReactQueryDevtools />
            </QueryClientProvider>
          </DatesProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
