import type { BlidActiveItem } from "@boklisten/backend/shared/blid_search";
import { Button, Group, Modal, Stack, TreeSelect } from "@mantine/core";
import { IconBuildingStore, IconCalendarDue } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import ChipButton from "@/shared/components/ChipButton";
import { useAppForm } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";
import { toBranchTreeNodeData } from "@/shared/utils/branchTree";
import { norwegianTime } from "@/shared/utils/dayjs";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";
import { publicApi } from "@/shared/utils/publicApiClient";

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

function ChangeBranchModal({
  activeItem,
  onClose,
}: {
  activeItem: BlidActiveItem;
  onClose: () => void;
}) {
  const { data: branches } = useQuery(publicApi.branches.getAll.queryOptions());
  const [branchId, setBranchId] = useState(activeItem.handoutBranchId);
  const updateMutation = useActiveItemUpdate("Filialen ble endret", onClose);
  return (
    <Modal opened onClose={onClose} title="Endre filial">
      <Stack>
        <TreeSelect
          label="Filial"
          description="Boka regnes som utdelt fra denne filialen"
          placeholder="Velg filial"
          data={toBranchTreeNodeData(branches ?? [])}
          // Unlike the signup picker: no expandOnClick, because a loan can sit on any branch
          // in the tree, so parents must be selectable too — the chevron alone expands. And no
          // renderNode, since it replaces the whole option content, chevron included.
          searchable
          nothingFoundMessage="Fant ingen filialer"
          // Wait for the branch data to be present so we can render its name
          value={branches ? branchId : null}
          onChange={setBranchId}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            loading={updateMutation.isPending}
            disabled={branchId === null || branchId === activeItem.handoutBranchId}
            onClick={() => {
              if (branchId === null) {
                return;
              }
              updateMutation.mutate({
                body: { customerItemId: activeItem.customerItemId, branchId },
              });
            }}
          >
            Endre filial
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function ChangeDeadlineModal({
  activeItem,
  onClose,
}: {
  activeItem: BlidActiveItem;
  onClose: () => void;
}) {
  const currentDeadline = norwegianTime(activeItem.deadline).format("YYYY-MM-DD");
  const updateMutation = useActiveItemUpdate("Fristen ble endret", onClose);
  const form = useAppForm({
    defaultValues: { deadline: currentDeadline },
    onSubmit: ({ value }) => {
      if (value.deadline === null) {
        return;
      }
      updateMutation.mutate({
        body: {
          customerItemId: activeItem.customerItemId,
          deadline: new Date(`${value.deadline}T00:00:00.000Z`).toISOString(),
        },
      });
    },
  });
  return (
    <Modal opened onClose={onClose} title="Endre frist">
      <Stack>
        <form.AppField name="deadline">
          {(field) => (
            <field.DeadlinePickerField
              clearable={false}
              description="Datoen boka skal leveres tilbake innen"
            />
          )}
        </form.AppField>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Avbryt
          </Button>
          <form.Subscribe selector={(state) => state.values.deadline}>
            {(deadline) => (
              <Button
                loading={updateMutation.isPending}
                disabled={deadline === null || deadline === currentDeadline}
                onClick={form.handleSubmit}
              >
                Endre frist
              </Button>
            )}
          </form.Subscribe>
        </Group>
      </Stack>
    </Modal>
  );
}

/**
 * The live entry's chips double as the admin's corrections to the active loan: clicking the
 * branch or frist chip opens the matching modal.
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
      {editing === "branch" && <ChangeBranchModal activeItem={activeItem} onClose={closeModal} />}
      {editing === "deadline" && (
        <ChangeDeadlineModal activeItem={activeItem} onClose={closeModal} />
      )}
    </Group>
  );
}
