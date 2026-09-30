import { AppShell, AppShellHeader, AppShellMain } from "@mantine/core";
import type { MantineSpacing, StyleProp } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { ReactNode } from "react";

import PublicPageFooter from "@/features/layout/PublicPageFooter";
import classes from "@/features/layout/public-nav/PublicNav.module.css";
import PublicMenuSheet from "@/features/layout/public-nav/PublicMenuSheet";
import PublicTabBar from "@/features/layout/public-nav/PublicTabBar";
import PublicTopBar from "@/features/layout/public-nav/PublicTopBar";

export default function PublicLayout({
  children,
  padding,
  withBorder,
  footerSpacing = "xl",
}: {
  children: ReactNode;
  padding: StyleProp<MantineSpacing>;
  withBorder: boolean;
  /** Space between the page and the footer; a page that paints its own background runs it to 0. */
  footerSpacing?: StyleProp<MantineSpacing>;
}) {
  const [menuOpened, { open: openMenu, close: closeMenu }] = useDisclosure();

  return (
    // The shell sets --public-tabbar-height for the footer and the fixed elements above the bar.
    <div className={classes.shell}>
      <AppShell header={{ height: 60 }} p={padding}>
        <AppShellHeader bg="brand" withBorder={withBorder}>
          <PublicTopBar onOpenMenu={openMenu} menuOpened={menuOpened} />
        </AppShellHeader>

        <AppShellMain
          // Keep the footer below the fold
          mih="calc(100dvh - var(--app-shell-header-height))"
        >
          {children}
        </AppShellMain>
      </AppShell>
      <PublicPageFooter mt={footerSpacing} />
      <PublicTabBar onOpenMenu={openMenu} menuOpened={menuOpened} />
      <PublicMenuSheet opened={menuOpened} onClose={closeMenu} />
    </div>
  );
}
