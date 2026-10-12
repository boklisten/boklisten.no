import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";
import CompanyManager from "@/features/companies/CompanyManager";

export const Route = createFileRoute("/(administrasjon)/admin/(administrator)/database/selskap")({
  head: () =>
    seo({
      title: "Selskap | bl-admin",
    }),
  component: DatabaseCompaniesPage,
});

function DatabaseCompaniesPage() {
  return <CompanyManager />;
}
