import type { BlidActiveItem } from "@boklisten/backend/shared/blid_search";
import { Group } from "@mantine/core";
import { IconBuildingStore, IconCalendarDue } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import ChipButton from "@/shared/components/ChipButton";
import ChangeBranchModal from "@/shared/components/corrections/ChangeBranchModal";
import ChangeDeadlineModal from "@/shared/components/corrections/ChangeDeadlineModal";
import useApiClient from "@/shared/hooks/useApiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

function useActiveItemUpdate(successMessage: string, onSaved: () => void) {
  const { api } = useApiClient();
  const queryClient = useQueryClient();
  return useMutation(
    api.blidSearch.updateActiveItem.mutationOptions({
      onSuccess: () => {
        showSuccessNotification(successMessage);
        onSaved();
      },
      onError: () => showErrorNotification("Klarte ikke oppdatere utlånet"),
      onSettled: () =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: api.blidSearch.lookup.pathKey() }),
          queryClient.invalidateQueries({ queryKey: api.branchBooks.getActiveBooks.pathKey() }),
          queryClient.invalidateQueries({
            queryKey: api.branchBooks.getActiveBookDetails.pathKey(),
          }),
        ]),
    }),
  );
}

/**
 * The live entry's chips double as the employee's corrections to the active loan: clicking the
 * branch or frist chip opens the matching modal. Both changes are monitored, so each modal says
 * so before the form.
 */
export default function ActiveItemChips({
  activeItem,
  branchLabel,
  fristLabel,
  expired,
}: {
  activeItem: BlidActiveItem;
  /** null when no branch is recorded on the active loan. */
  branchLabel: string | null;
  fristLabel: string;
  expired: boolean;
}) {
  const [editing, setEditing] = useState<"branch" | "deadline" | null>(null);
  const closeModal = () => setEditing(null);
  const branchMutation = useActiveItemUpdate("Filialen ble endret", closeModal);
  const deadlineMutation = useActiveItemUpdate("Fristen ble endret", closeModal);
  return (
    <Group gap={6} mt={6}>
      <ChipButton
        icon={IconBuildingStore}
        color="gray"
        title="Endre filial"
        onClick={() => setEditing("branch")}
      >
        {branchLabel ?? "Velg filial"}
      </ChipButton>
      <ChipButton
        icon={IconCalendarDue}
        color={expired ? "red" : "gray"}
        title="Endre frist"
        onClick={() => setEditing("deadline")}
      >
        Frist: {fristLabel}
      </ChipButton>
      {editing === "branch" && (
        <ChangeBranchModal
          currentBranchId={activeItem.handoutBranchId}
          description="Boka regnes som utdelt fra denne filialen"
          isPending={branchMutation.isPending}
          onClose={closeModal}
          onSubmit={(branchId) =>
            branchMutation.mutate({ body: { customerItemId: activeItem.customerItemId, branchId } })
          }
        />
      )}
      {editing === "deadline" && (
        <ChangeDeadlineModal
          currentDeadline={activeItem.deadline}
          description="Datoen boka skal leveres tilbake innen"
          isPending={deadlineMutation.isPending}
          onClose={closeModal}
          onSubmit={(deadline) =>
            deadlineMutation.mutate({
              body: { customerItemId: activeItem.customerItemId, deadline },
            })
          }
        />
      )}
    </Group>
  );
}
