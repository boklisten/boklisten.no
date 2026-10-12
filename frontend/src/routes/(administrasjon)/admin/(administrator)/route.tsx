import { createFileRoute, Outlet } from "@tanstack/react-router";

import AuthGuard from "@/features/auth/AuthGuard";

export const Route = createFileRoute("/(administrasjon)/admin/(administrator)")({
  component: AdministratorPages,
});

/**
 * One gate for every admin-only page (Faktura, Kommunikasjon, Databaseverktøy), so a page in this
 * group never needs its own. Managers and employees who open one by URL land on the
 * permission-denied page, as the API would refuse them anyway.
 */
function AdministratorPages() {
  return (
    <AuthGuard requiredPermission="admin">
      <Outlet />
    </AuthGuard>
  );
}
