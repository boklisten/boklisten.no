import type { Branch } from "@boklisten/backend/shared/branch";
import { Button, Stack } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAppForm } from "@/shared/hooks/form";
import { api } from "@/shared/utils/apiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

export default function BranchRelationshipSettings({ branch }: { branch: Branch }) {
  const queryClient = useQueryClient();

  const { data: branches } = useQuery(api.branches.index.queryOptions());

  const branchOptions =
    branches
      ?.filter((b) => b.id !== branch.id)
      .map((b) => ({
        value: b.id,
        label: b.name,
      })) ?? [];

  const updateRelationshipsMutation = useMutation(
    api.branchRelationships.update.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: api.branches.index.pathKey(),
        }),
      onSuccess: () => showSuccessNotification("Filial ble oppdatert!"),
      onError: () => showErrorNotification("Klarte ikke oppdatere filial!"),
    }),
  );

  const form = useAppForm({
    defaultValues: {
      localName: branch.localName ?? "",
      parentBranchId: branch.parentBranchId ?? "",
      // Children are derived from the other branches' parent references.
      childBranchIds:
        branches?.filter((b) => b.parentBranchId === branch.id).map((b) => b.id) ?? [],
      childLabel: branch.childLabel ?? "",
    },
    onSubmit: ({ value }) =>
      updateRelationshipsMutation.mutate({
        body: {
          id: branch.id,
          localName: value.localName || null,
          childLabel: value.childLabel || null,
          parentBranchId: value.parentBranchId || null,
          childBranchIds: value.childBranchIds,
        },
      }),
  });

  return (
    <Stack>
      <form.AppField name="localName">
        {(field) => <field.TextField label="Lokalt navn" placeholder="Flåklypa" />}
      </form.AppField>
      <form.AppField name="parentBranchId">
        {(field) => (
          <field.SelectField
            label="Tilhører"
            placeholder="Velg filial"
            data={branchOptions}
            searchable
            clearable
          />
        )}
      </form.AppField>
      <form.AppField name="childLabel">
        {(field) => <field.TextField label="Delt inn i" placeholder="årskull, klasse, parallell" />}
      </form.AppField>
      <form.AppField name="childBranchIds">
        {(field) => (
          <field.MultiSelectField
            label="Består av"
            placeholder="Velg filialer"
            data={branchOptions}
            searchable
            clearable
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.ErrorSummary />
      </form.AppForm>
      <Button
        color="green"
        onClick={form.handleSubmit}
        loading={updateRelationshipsMutation.isPending}
      >
        {!branch ? "Opprett" : "Lagre"}
      </Button>
    </Stack>
  );
}
