import { IconBuildingStore } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import ChipButton from "@/shared/components/ChipButton";
import ChangeBranchModal from "@/shared/components/corrections/ChangeBranchModal";
import useApiClient from "@/shared/hooks/useApiClient";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

/**
 * The order's branch as an editable chip. Changing it moves the order alone: the customer items
 * it created keep the branch they were handed out from. Any employee may do it; the change is
 * monitored, so the modal says so before the form.
 */
export default function OrderBranchChip({
  orderId,
  branchId,
  branchName,
  onChanged,
}: {
  orderId: string;
  branchId: string;
  branchName: string;
  /** For callers that list the order somewhere other than the order history. */
  onChanged?: () => void;
}) {
  const { api } = useApiClient();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const updateMutation = useMutation(
    api.orderHistory.updateBranch.mutationOptions({
      onSuccess: () => {
        showSuccessNotification("Filialen ble endret");
        setEditing(false);
      },
      onError: (error) => showErrorNotification(errorMessage(error, "Klarte ikke endre filialen")),
      onSettled: () => {
        onChanged?.();
        return queryClient.invalidateQueries({
          queryKey: api.orderHistory.getForCustomer.pathKey(),
        });
      },
    }),
  );
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
          currentBranchId={branchId}
          description="Ordren regnes som lagt inn på denne filialen. Alle bestilte bøker i ordren flyttes med, mens bøker som allerede er delt ut beholder filialen sin."
          isPending={updateMutation.isPending}
          onClose={() => setEditing(false)}
          onSubmit={(newBranchId) =>
            updateMutation.mutate({ params: { orderId }, body: { branchId: newBranchId } })
          }
        />
      )}
    </>
  );
}
