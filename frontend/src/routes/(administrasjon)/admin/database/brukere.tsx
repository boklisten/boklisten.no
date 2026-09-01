import { createFileRoute } from "@tanstack/react-router";

import AuthGuard from "@/features/auth/AuthGuard";
import UserManager, { parseUserManagerTab } from "@/features/user-management/UserManager";
import type { UserManagerTab } from "@/features/user-management/UserManager";
import { seo } from "@/shared/utils/seo";

interface UserManagerSearch {
  brukerFane?: UserManagerTab;
}

export const Route = createFileRoute("/(administrasjon)/admin/database/brukere")({
  validateSearch: (search: Record<string, unknown>): UserManagerSearch => ({
    brukerFane: parseUserManagerTab(search["brukerFane"]),
  }),
  head: () =>
    seo({
      title: "Brukere | bl-admin",
    }),
  component: DatabaseUsersPage,
});

function DatabaseUsersPage() {
  return (
    <AuthGuard requiredPermission="admin">
      <UserManager />
    </AuthGuard>
  );
}
