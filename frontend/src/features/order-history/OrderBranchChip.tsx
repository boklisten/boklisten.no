import { Button, Group, Modal, Stack, TreeSelect } from "@mantine/core";
import { IconBuildingStore } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import ChipButton from "@/shared/components/ChipButton";
import useApiClient from "@/shared/hooks/useApiClient";
import { toBranchTreeNodeData } from "@/shared/utils/branchTree";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

function ChangeBranchModal({
  orderId,
  branchId: currentBranchId,
  onClose,
}: {
  orderId: string;
  branchId: string;
  onClose: () => void;
}) {
  const { api } = useApiClient();
  const queryClient = useQueryClient();
  const { data: branches } = useQuery(api.branches.getAll.queryOptions());
  const [branchId, setBranchId] = useState<string | null>(currentBranchId);
  const updateMutation = useMutation(
    api.orderHistory.updateBranch.mutationOptions({
      onSuccess: () => {
        showSuccessNotification("Filialen ble endret");
        onClose();
      },
      onError: (error) => showErrorNotification(errorMessage(error, "Klarte ikke endre filialen")),
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: api.orderHistory.getForCustomer.pathKey() }),
    }),
  );
  return (
    <Modal opened onClose={onClose} title="Endre filial">
      <Stack>
        <TreeSelect
          label="Filial"
          description="Ordren regnes som lagt inn på denne filialen. Bøkene som ble delt ut beholder filialen sin."
          placeholder="Velg filial"
          data={toBranchTreeNodeData(branches ?? [])}
          // Parents must be selectable too, so no expandOnClick: the chevron alone expands.
          searchable
          nothingFoundMessage="Fant ingen filialer"
          // Wait for the branch data so the current name can be rendered.
          value={branches ? branchId : null}
          onChange={setBranchId}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            loading={updateMutation.isPending}
            disabled={branchId === null || branchId === currentBranchId}
            onClick={() => {
              if (branchId === null) {
                return;
              }
              updateMutation.mutate({ params: { orderId }, body: { branchId } });
            }}
          >
            Endre filial
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/**
 * The order's branch as an editable chip, for admins. Changing it moves the order alone: the
 * customer items it created keep the branch they were handed out from.
 */
export default function OrderBranchChip({
  orderId,
  branchId,
  branchName,
}: {
  orderId: string;
  branchId: string;
  branchName: string;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <ChipButton
        icon={IconBuildingStore}
        color="gray"
        title="Endre filial"
        onClick={() => setEditing(true)}
      >
        {branchName}
      </ChipButton>
      {editing && (
        <ChangeBranchModal
          orderId={orderId}
          branchId={branchId}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
