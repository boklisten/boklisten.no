import { Stack, Text, Title, TreeSelect } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";
import { useEffect } from "react";
import { api } from "@/shared/utils/apiClient";
import {
  getBranchNodeShortLabel,
  toBranchTreeNodeData,
  withAncestors,
} from "@/shared/utils/branchTree";

export const Route = createFileRoute("/(offentlig)/info/branch")({
  head: () =>
    seo({
      title: "Skoler og åpningstider | Boklisten.no",
      description: "Skal du hente eller levere bøker? Finn ut når vi står på stand på din skole.",
    }),
  component: BranchInfoPageLayout,
});

function BranchInfoPageLayout() {
  // Every branch the viewer may see, not only the orderable ones: a collection point has opening
  // hours but no books.
  const { data: branches } = useQuery(api.branches.index.queryOptions());
  const [selectedBranchId, setSelectedBranchId] = useLocalStorage({ key: "selectedBranchId" });
  const navigate = Route.useNavigate();

  const branchId = useParams({
    from: "/(offentlig)/info/branch/$branchId",
    shouldThrow: false,
    select: (params) => params.branchId,
  });

  useEffect(() => {
    if (!branchId && selectedBranchId) {
      void navigate({
        to: "/info/branch/$branchId",
        params: { branchId: selectedBranchId },
        replace: true,
      });
    }
  }, [branchId, selectedBranchId, navigate]);

  return (
    <>
      <Stack gap={5}>
        <Title>Åpningstider</Title>
        <Text size="sm" fs="italic">
          Her vises åpningstider for privatist-filialer. VGS-elever får beskjed fra skolen om
          åpningstider.
        </Text>
      </Stack>
      <TreeSelect
        label="Valgt skole"
        placeholder="Din skole"
        // Privatist branches can sit under an untyped grouping branch ("Akademiet"), which must
        // stay in so they nest under it.
        data={toBranchTreeNodeData(
          withAncestors(branches ?? [], (branch) => branch.type === "privatist"),
        )}
        renderNode={({ node, hasChildren }) => (hasChildren ? null : getBranchNodeShortLabel(node))}
        expandOnClick
        searchable
        nothingFoundMessage="Fant ingen skoler"
        // Wait for the branch data to be present so we can render its name
        value={branches ? (branchId ?? selectedBranchId ?? null) : null}
        onChange={(value) => {
          if (!value) {
            return;
          }
          setSelectedBranchId(value);
          void navigate({ to: "/info/branch/$branchId", params: { branchId: value } });
        }}
      />
      <Outlet />
    </>
  );
}
