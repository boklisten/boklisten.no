import { AppShell, AppShellHeader, AppShellMain, Group } from "@mantine/core";
import type { MantineSpacing, StyleProp } from "@mantine/core";

import CartNavbarIndicator from "@/features/cart/CartNavbarIndicator";
import Logo from "@/features/layout/Logo";
import PublicNavigationDrawer from "@/features/layout/PublicNavigationDrawer";
import PublicPageFooter from "@/features/layout/PublicPageFooter";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import type { ReactNode } from "react";

export default function PublicLayout({
  children,
  padding,
  withBorder,
}: {
  children: ReactNode;
  padding: StyleProp<MantineSpacing>;
  withBorder: boolean;
}) {
  return (
    <>
      <AppShell header={{ height: 65 }} p={padding}>
        <AppShellHeader bg="brand" withBorder={withBorder}>
          <Group h="100%" justify="space-between" align="center" px="md">
            <Logo variant="white" />
            <Group>
              <CartNavbarIndicator />
              <Group gap="xl" visibleFrom="sm">
                <TanStackAnchor c="#fff" to="/info/general">
                  Info
                </TanStackAnchor>
                <TanStackAnchor c="#fff" to="/bestilling">
                  Bestill bøker
                </TanStackAnchor>
              </Group>
              <PublicNavigationDrawer />
            </Group>
          </Group>
        </AppShellHeader>

        <AppShellMain
          // Keep the footer below the fold
          mih="calc(100dvh - var(--app-shell-header-height))"
        >
          {children}
        </AppShellMain>
      </AppShell>
      <PublicPageFooter />
    </>
  );
}
