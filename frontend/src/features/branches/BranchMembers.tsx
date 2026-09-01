import { Button, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity } from "react";

import BranchMembersTable from "@/features/branches/BranchMembersTable";
import BranchScopeMetrics from "@/shared/components/BranchScopeMetrics";
import useApiClient from "@/shared/hooks/useApiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

export default function BranchMembers({ branchId }: { branchId: string }) {
  const { api, client } = useApiClient();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(
    api.branchMembership.getMembers.queryOptions({ params: { branchId } }),
  );

  const removeMembersMutation = useMutation({
    mutationFn: async ({
      branchId: targetBranchId,
      scope,
    }: {
      branchId: string;
      scope: "direct" | "indirect";
    }) =>
      scope === "direct"
        ? client.api.branchMembership.removeDirectMembers({
            params: { branchId: targetBranchId },
          })
        : client.api.branchMembership.removeIndirectMembers({
            params: { branchId: targetBranchId },
          }),
    onSuccess: () => showSuccessNotification("Medlemsliste ble oppdatert"),
    onError: () => showErrorNotification("Klarte ikke oppdatere medlemsliste"),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: api.branchMembership.getMembers.queryKey({ params: { branchId } }),
      }),
  });

  function removeMembersButton(scope: "direct" | "indirect", subject: string) {
    return (
      <Button
        variant="subtle"
        c="red"
        loading={removeMembersMutation.isPending}
        onClick={() =>
          modals.openConfirmModal({
            title: "Bekreft sletting av medlemsskap",
            children: `Du er i ferd med å slette medlemsskapene til ${subject}. Dette kan ikke angres.`,
            labels: { cancel: "Avbryt", confirm: "Bekreft" },
            onConfirm: () => removeMembersMutation.mutate({ branchId, scope }),
          })
        }
      >
        Fjern medlemmer
      </Button>
    );
  }

  return (
    <>
      <BranchScopeMetrics
        isLoading={isLoading}
        total={data ? data.directMembers.length + data.indirectMembers.count : undefined}
        direct={data?.directMembers.length}
        indirect={data?.indirectMembers.count}
        directExtra={
          <Activity mode={(data?.directMembers.length ?? 0) > 0 ? "visible" : "hidden"}>
            {removeMembersButton("direct", "denne filialen")}
          </Activity>
        }
        indirectExtra={
          <Activity mode={(data?.indirectMembers.count ?? 0) > 0 ? "visible" : "hidden"}>
            {removeMembersButton("indirect", "denne filialens underfilialer")}
          </Activity>
        }
      />
      <Title order={3}>Medlemmer av denne filialen</Title>
      <BranchMembersTable
        branchId={branchId}
        members={data?.directMembers ?? []}
        isLoading={isLoading}
      />
    </>
  );
}
