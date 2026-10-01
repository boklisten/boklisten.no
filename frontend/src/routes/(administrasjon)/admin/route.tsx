import { createFileRoute, Outlet } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";
import { USER_PERMISSION } from "@boklisten/backend/shared/user-permission";
import { AppShell, AppShellHeader, AppShellMain, AppShellNavbar } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { AllCommunityModule } from "ag-grid-community";
import { AgGridProvider } from "ag-grid-react";
import AgGridColorSchemeSync from "@/shared/components/AgGridColorSchemeSync";
import AuthGuard from "@/features/auth/AuthGuard";
import AdminMenuSheet from "@/features/layout/admin-nav/AdminMenuSheet";
import AdminSidebar from "@/features/layout/admin-nav/AdminSidebar";
import AdminTopBar from "@/features/layout/admin-nav/AdminTopBar";
import { ADMIN_PRIMARY_LINKS } from "@/features/layout/admin-nav/adminNavigation";
import classes from "@/features/layout/nav/Nav.module.css";
import { TOP_BAR_HEIGHT } from "@/features/layout/nav/navigation";
import TabBar from "@/features/layout/nav/TabBar";
import GlobalSearch from "@/features/search/GlobalSearch";

export const Route = createFileRoute("/(administrasjon)/admin")({
  head: () =>
    seo({
      title: "bl-admin",
    }),
  component: AdminPageLayout,
});

/**
 * bl-admin's frame: the sidebar from `sm` up, and below that the same tab bar and menu sheet as
 * the public site, with Hjem, Kasse, Venteliste and Meny.
 */
function AdminPageLayout() {
  const [menuOpened, { open: openMenu, close: closeMenu }] = useDisclosure();

  return (
    // The shell sets --tabbar-height for the page and the fixed elements above the bar.
    <div className={classes.shell}>
      <AppShell
        header={{ height: TOP_BAR_HEIGHT }}
        navbar={{ breakpoint: "sm", width: 220, collapsed: { mobile: true } }}
        padding="md"
      >
        <AppShellHeader bg="brand" withBorder={false}>
          <AdminTopBar />
        </AppShellHeader>
        <AppShellNavbar className={classes.adminNavbar}>
          <AdminSidebar />
        </AppShellNavbar>
        <AppShellMain className={classes.adminMain}>
          <AuthGuard requiredPermission={USER_PERMISSION.EMPLOYEE}>
            <AgGridProvider modules={[AllCommunityModule]}>
              <AgGridColorSchemeSync />
              <GlobalSearch />
              <Outlet />
            </AgGridProvider>
          </AuthGuard>
        </AppShellMain>
      </AppShell>
      <TabBar links={ADMIN_PRIMARY_LINKS} menuOpened={menuOpened} onOpenMenu={openMenu} />
      <AdminMenuSheet opened={menuOpened} onClose={closeMenu} />
    </div>
  );
}
