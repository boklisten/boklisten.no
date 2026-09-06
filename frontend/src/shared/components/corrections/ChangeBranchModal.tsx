import { Button, Group, Modal, Stack, TreeSelect } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import MonitoringNotice from "@/shared/components/MonitoringNotice";
import { toBranchTreeNodeData } from "@/shared/utils/branchTree";
import { publicApi } from "@/shared/utils/publicApiClient";

/**
 * An employee's correction of which branch a book or order belongs to. The change is monitored,
 * so the modal says so before the form. The caller owns the write; this only collects the choice.
 */
export default function ChangeBranchModal({
  currentBranchId,
  description,
  isPending,
  onClose,
  onSubmit,
}: {
  /** null when no branch is recorded. */
  currentBranchId: string | null;
  /** What the branch means for this thing, shown under the picker label. */
  description: string;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (branchId: string) => void;
}) {
  const { data: branches } = useQuery(publicApi.branches.getAll.queryOptions());
  const [branchId, setBranchId] = useState(currentBranchId);
  return (
    <Modal opened onClose={onClose} title="Endre filial">
      <Stack>
        <MonitoringNotice>Administrator får beskjed hvis du endrer filialen.</MonitoringNotice>
        <TreeSelect
          label="Filial"
          description={description}
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
            loading={isPending}
            disabled={branchId === null || branchId === currentBranchId}
            onClick={() => {
              if (branchId !== null) {
                onSubmit(branchId);
              }
            }}
          >
            Endre filial
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
