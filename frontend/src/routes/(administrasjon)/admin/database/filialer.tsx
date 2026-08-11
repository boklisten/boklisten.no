import BranchManager from "@/features/branches/BranchManager";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(administrasjon)/admin/database/filialer")({
  head: () =>
    seo({
      title: "Filialer | bl-admin",
    }),
  component: DatabaseBranchesPage,
});

function DatabaseBranchesPage() {
  return <BranchManager />;
}
