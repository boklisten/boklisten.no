import { Select, Stack, Text, Title } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";
import { useEffect } from "react";

import { publicApi } from "@/shared/utils/publicApiClient";

export const Route = createFileRoute("/(offentlig)/info/branch")({
  head: () =>
    seo({
      title: "Skoler og åpningstider | Boklisten.no",
      description: "Skal du hente eller levere bøker? Finn ut når vi står på stand på din skole.",
    }),
  component: BranchInfoPageLayout,
});

function BranchInfoPageLayout() {
  const { data: branches } = useQuery(publicApi.branches.getPublic.queryOptions());
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
        <Text size={"sm"} fs={"italic"}>
          Her vises åpningstider for privatist-filialer. VGS-elever får beskjed fra skolen om
          åpningstider.
        </Text>
      </Stack>
      <Select
        label={"Valgt skole"}
        placeholder={"Din skole"}
        value={branchId ?? selectedBranchId ?? ""}
        onChange={(value) => {
          if (!value) return;
          setSelectedBranchId(value);
          void navigate({ to: "/info/branch/$branchId", params: { branchId: value } });
        }}
        data={(branches ?? [])
          .filter((branch) => branch.type === "privatist")
          .map((branch) => ({ value: branch.id, label: branch.name }))}
      />
      <Outlet />
    </>
  );
}
