import { createFileRoute, Outlet } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";
import { USER_PERMISSION } from "@boklisten/backend/shared/user-permission";
import { AppShell, AppShellHeader, AppShellMain, AppShellNavbar } from "@mantine/core";
import { AllCommunityModule } from "ag-grid-community";
import { AgGridProvider } from "ag-grid-react";
import AgGridColorSchemeSync from "@/shared/components/AgGridColorSchemeSync";
import AuthGuard from "@/features/auth/AuthGuard";
import AdminPageHeader from "@/features/layout/AdminPageHeader";
import AdminPageNavigation from "@/features/layout/AdminPageNavigation";
import GlobalSearch from "@/features/search/GlobalSearch";

export const Route = createFileRoute("/(administrasjon)/admin")({
  head: () =>
    seo({
      title: "bl-admin",
    }),
  component: AdminPageLayout,
});

function AdminPageLayout() {
  return (
    <AppShell
      header={{ height: 65 }}
      navbar={{ breakpoint: "xs", width: 200, collapsed: { mobile: true } }}
      padding="md"
    >
      <AppShellHeader bg="brand">
        <AdminPageHeader />
      </AppShellHeader>
      <AppShellNavbar>
        <AdminPageNavigation />
      </AppShellNavbar>
      <AppShellMain>
        <AuthGuard requiredPermission={USER_PERMISSION.EMPLOYEE}>
          <AgGridProvider modules={[AllCommunityModule]}>
            <AgGridColorSchemeSync />
            <GlobalSearch />
            <Outlet />
          </AgGridProvider>
        </AuthGuard>
      </AppShellMain>
    </AppShell>
  );
}
