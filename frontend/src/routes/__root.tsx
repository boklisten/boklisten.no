import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/tiptap/styles.css";
import "@mantine/charts/styles.css";
import "@/shared/utils/dayjs";

import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { AllCommunityModule } from "ag-grid-community";
import { AgGridProvider } from "ag-grid-react";

import theme from "@/shared/utils/theme";
import { DatesProvider } from "@mantine/dates";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
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
            <ModalsProvider>
              <AgGridProvider modules={[AllCommunityModule]}>
                <Outlet />
                <Scripts />
              </AgGridProvider>
            </ModalsProvider>
            <ReactQueryDevtools />
          </DatesProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
