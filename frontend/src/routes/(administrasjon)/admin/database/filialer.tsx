import BranchManager, { parseBranchManagerTab } from "@/features/branches/BranchManager";
import type { BranchManagerTab } from "@/features/branches/BranchManager";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

interface BranchManagerSearch {
  filial?: string;
  filialFane?: BranchManagerTab;
}

export const Route = createFileRoute("/(administrasjon)/admin/database/filialer")({
  validateSearch: (search: Record<string, unknown>): BranchManagerSearch => ({
    filial:
      typeof search["filial"] === "string" && search["filial"] !== ""
        ? search["filial"]
        : undefined,
    filialFane: parseBranchManagerTab(search["filialFane"]),
  }),
  head: () =>
    seo({
      title: "Filialer | bl-admin",
    }),
  component: DatabaseBranchesPage,
});

function DatabaseBranchesPage() {
  return <BranchManager />;
}
