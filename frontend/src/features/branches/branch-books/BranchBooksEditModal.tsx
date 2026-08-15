import { Alert, Button, Checkbox, Group, Stack, Text } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { BranchBooksEditKind, BranchBooksEditTarget } from "@/features/branches/branch-books/types";
import SelectBranchTreeView from "@/shared/components/SelectBranchTreeView";
import { useAppForm } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";
import asyncConfirmModal from "@/shared/utils/asyncConfirmModal";
import { norwegianTime } from "@/shared/utils/dayjs";

function bookCountLabel(count: number) {
  return count === 1 ? "1 bok" : `${count} bøker`;
}

/**
 * Shared mass-edit form for both branch-book pages: pick a new deadline or a new branch, choose
 * whether descendants are included, and confirm explicitly before anything is written.
 */
export default function BranchBooksEditModal({
  kind,
  target,
  branchId,
  branchMoveNote,
  onSubmit,
  onClose,
}: {
  kind: BranchBooksEditKind;
  target: BranchBooksEditTarget;
  branchId: string;
  /** Extra warning shown for branch moves, e.g. that whole orders are moved */
  branchMoveNote?: string;
  onSubmit: (
    update: { deadline?: string; branchId?: string },
    includeDescendants: boolean,
  ) => Promise<unknown>;
  onClose: () => void;
}) {
  const { api } = useApiClient();
  const { data: branches } = useQuery(api.branches.getAll.queryOptions());

  const form = useAppForm({
    defaultValues: { deadline: null as string | null },
  });
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [includeDescendants, setIncludeDescendants] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const indirectCount = target.total - target.direct;
  const affectedCount = includeDescendants ? target.total : target.direct;
  const targetBranch = branches?.find((branch) => branch.id === selectedBranchId);

  async function submit() {
    if (isSubmitting) return;
    const deadline = form.state.values.deadline;
    const sentence =
      kind === "deadline"
        ? `Setter ny frist ${norwegianTime(deadline).format("D. MMMM YYYY")} for ${target.description}.`
        : `Flytter ${target.description} til ${targetBranch?.name}.`;
    const confirmed = await asyncConfirmModal({
      title: kind === "deadline" ? "Bekreft ny frist" : "Bekreft flytting",
      children: `${sentence} Dette gjelder ${bookCountLabel(affectedCount)} og kan ikke angres automatisk.`,
      confirmLabel: "Bekreft",
      zIndex: 1000,
    });
    if (!confirmed) return;
    setIsSubmitting(true);
    try {
      await onSubmit(
        kind === "deadline"
          ? { deadline: new Date(`${deadline}T00:00:00.000Z`).toISOString() }
          : { branchId: selectedBranchId ?? "" },
        includeDescendants,
      );
      onClose();
    } catch {
      // The mutation's onError notification covers this; keep the modal open for a retry
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Stack>
      <Text>Gjelder {target.description}</Text>
      {target.allowDescendants && indirectCount > 0 && (
        <Checkbox
          label={`Inkluder ${bookCountLabel(indirectCount)} fra underliggende filialer`}
          checked={includeDescendants}
          onChange={(event) => setIncludeDescendants(event.currentTarget.checked)}
        />
      )}
      {kind === "deadline" ? (
        <form.AppField name={"deadline"}>
          {(field) => <field.DeadlinePickerField label={"Velg ny frist"} />}
        </form.AppField>
      ) : (
        <SelectBranchTreeView
          label={"Velg ny filial"}
          branches={branches ?? []}
          onSelect={setSelectedBranchId}
        />
      )}
      {kind === "branch" && selectedBranchId === branchId && (
        <Alert icon={<IconInfoCircle />} color={"gray"}>
          Bøkene er allerede på denne filialen. Velg en annen filial.
        </Alert>
      )}
      {kind === "branch" && branchMoveNote && (
        <Alert icon={<IconInfoCircle />} color={"yellow"}>
          {branchMoveNote}
        </Alert>
      )}
      <Group justify={"flex-end"}>
        <Button variant={"default"} onClick={onClose}>
          Avbryt
        </Button>
        <form.Subscribe selector={(state) => state.values.deadline}>
          {(deadline) => {
            const valueIsPicked =
              kind === "deadline"
                ? deadline !== null
                : selectedBranchId !== null && selectedBranchId !== branchId;
            return (
              <Button
                disabled={!valueIsPicked || affectedCount === 0}
                loading={isSubmitting}
                onClick={submit}
              >
                {kind === "deadline" ? "Endre frist" : "Flytt"} ({bookCountLabel(affectedCount)})
              </Button>
            );
          }}
        </form.Subscribe>
      </Group>
    </Stack>
  );
}
