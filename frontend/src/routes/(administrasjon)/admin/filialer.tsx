import BranchManager from "@/features/branches/BranchManager";
import { parseBranchManagerTab } from "@/features/branches/branchManagerTabs";
import type { BranchManagerTab } from "@/features/branches/branchManagerTabs";
import { createFileRoute } from "@tanstack/react-router";

import AuthGuard from "@/features/auth/AuthGuard";

import { validateBranchRoundsSearch } from "@/features/matches/adminOverview/branchRoundsSearch";
import type { BranchRoundsSearch } from "@/features/matches/adminOverview/branchRoundsSearch";
import { seo } from "@/shared/utils/seo";

interface BranchManagerSearch extends BranchRoundsSearch {
  filial?: string;
  filialFane?: BranchManagerTab;
}

export const Route = createFileRoute("/(administrasjon)/admin/filialer")({
  validateSearch: (search: Record<string, unknown>): BranchManagerSearch => ({
    filial:
      typeof search["filial"] === "string" && search["filial"] !== ""
        ? search["filial"]
        : undefined,
    filialFane: parseBranchManagerTab(search["filialFane"]),
    ...validateBranchRoundsSearch(search),
  }),
  head: () =>
    seo({
      title: "Filialer | bl-admin",
    }),
  component: BranchesPage,
});

/** The Filialer workspace: managers (Filialsjef) and admins; employees get the permission-denied page. */
function BranchesPage() {
  return (
    <AuthGuard requiredPermission="manager">
      <BranchManager />
    </AuthGuard>
  );
}
