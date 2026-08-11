import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";
import AuthGuard from "@/features/auth/AuthGuard";
import CompanyManager from "@/features/companies/CompanyManager";

export const Route = createFileRoute("/(administrasjon)/admin/database/selskap")({
  head: () =>
    seo({
      title: "Selskap | bl-admin",
    }),
  component: DatabaseCompaniesPage,
});

function DatabaseCompaniesPage() {
  return (
    <AuthGuard requiredPermission={"admin"}>
      <CompanyManager />
    </AuthGuard>
  );
}
