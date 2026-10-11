import { Button, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity } from "react";

import BranchMembersTable from "@/features/branches/BranchMembersTable";
import BranchScopeMetrics from "@/shared/components/BranchScopeMetrics";
import { api, apiClient } from "@/shared/utils/apiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

export default function BranchMembers({
  branchId,
  isRoot,
}: {
  branchId: string;
  /** The root has nothing above it to move members to, so it offers no removal. */
  isRoot: boolean;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(
    api.branchMembers.index.queryOptions({ params: { branchId } }),
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
        ? apiClient.api.branchMembers.destroyDirect({
            params: { branchId: targetBranchId },
          })
        : apiClient.api.branchMembers.destroyIndirect({
            params: { branchId: targetBranchId },
          }),
    onSuccess: () => showSuccessNotification("Medlemsliste ble oppdatert"),
    onError: () => showErrorNotification("Klarte ikke oppdatere medlemsliste"),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: api.branchMembers.index.queryKey({ params: { branchId } }),
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
            title: "Bekreft fjerning av medlemmer",
            children: `Du er i ferd med å fjerne medlemmene av ${subject}. De blir stående uten skole. Dette kan ikke angres.`,
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
          <Activity mode={!isRoot && (data?.directMembers.length ?? 0) > 0 ? "visible" : "hidden"}>
            {removeMembersButton("direct", "denne filialen")}
          </Activity>
        }
        indirectExtra={
          <Activity mode={!isRoot && (data?.indirectMembers.count ?? 0) > 0 ? "visible" : "hidden"}>
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
