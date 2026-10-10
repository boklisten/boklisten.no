import { AppShell, AppShellHeader, AppShellMain } from "@mantine/core";
import type { MantineSpacing, StyleProp } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { ReactNode } from "react";

import PublicPageFooter from "@/features/layout/PublicPageFooter";
import classes from "@/features/layout/nav/Nav.module.css";
import { TOP_BAR_HEIGHT } from "@/features/layout/nav/navigation";
import TabBar from "@/features/layout/nav/TabBar";
import PublicMenuSheet from "@/features/layout/public-nav/PublicMenuSheet";
import PublicTopBar from "@/features/layout/public-nav/PublicTopBar";
import { primaryLinks } from "@/features/layout/public-nav/publicNavigation";
import useAuth from "@/shared/hooks/useAuth";

export default function PublicLayout({
  children,
  padding,
  footerSpacing = "xl",
}: {
  children: ReactNode;
  /** Above and below the page; the side gutter is the page's own Container. */
  padding: StyleProp<MantineSpacing>;
  /** Space between the page and the footer; a page that paints its own background runs it to 0. */
  footerSpacing?: StyleProp<MantineSpacing>;
}) {
  const [menuOpened, { open: openMenu, close: closeMenu }] = useDisclosure();
  const { isLoggedIn } = useAuth();

  return (
    // The shell sets --tabbar-height for the footer and the fixed elements above the bar.
    <div className={`${classes.shell} ${classes.publicShell}`}>
      <AppShell header={{ height: TOP_BAR_HEIGHT }} py={padding}>
        {/* The bar is solid teal; a hairline under it would read as a stray light line. */}
        <AppShellHeader bg="brand" withBorder={false}>
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
      <TabBar links={primaryLinks(isLoggedIn)} menuOpened={menuOpened} onOpenMenu={openMenu} />
      <PublicMenuSheet opened={menuOpened} onClose={closeMenu} />
    </div>
  );
}
