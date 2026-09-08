import { List, Text } from "@mantine/core";
import { IconBuildingStore } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import ChipButton from "@/shared/components/ChipButton";
import ChangeBranchModal from "@/shared/components/corrections/ChangeBranchModal";
import useApiClient from "@/shared/hooks/useApiClient";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

const NO_OTHER_BOOKS: string[] = [];

/** The other books on the order that move with it, named so the employee is not surprised. */
function AlsoMoving({ titles }: { titles: string[] }) {
  if (titles.length === 0) {
    return null;
  }
  return (
    <Text size="sm" component="div">
      {titles.length === 1
        ? "Denne bestilte boka på samme ordre flyttes også:"
        : "Disse bestilte bøkene på samme ordre flyttes også:"}
      <List size="sm" mt={4}>
        {titles.map((title) => (
          <List.Item key={title}>{title}</List.Item>
        ))}
      </List>
    </Text>
  );
}

/**
 * The order's branch as an editable chip. Changing it moves the order alone: the customer items
 * it created keep the branch they were handed out from. Any employee may do it; the change is
 * monitored, so the modal says so before the form.
 */
export default function OrderBranchChip({
  orderId,
  branchId,
  branchName,
  alsoMoving = NO_OTHER_BOOKS,
  onChanged,
}: {
  orderId: string;
  branchId: string;
  branchName: string;
  /** Titles of the other ordered books on the order, when the chip stands beside one of them. */
  alsoMoving?: string[];
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
          consequences={<AlsoMoving titles={alsoMoving} />}
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
