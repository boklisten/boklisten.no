import type { Branch } from "@boklisten/backend/shared/branch";
import { Button, Stack } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAppForm } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

export default function BranchRelationshipSettings({ branch }: { branch: Branch }) {
  const queryClient = useQueryClient();
  const { api } = useApiClient();

  const { data: branches } = useQuery(api.branches.getAll.queryOptions());

  const branchOptions =
    branches
      ?.filter((b) => b.id !== branch.id)
      .map((b) => ({
        value: b.id,
        label: b.name,
      })) ?? [];

  const updateRelationshipsMutation = useMutation(
    api.branchRelationship.update.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: api.branches.getAll.pathKey(),
        }),
      onSuccess: () => showSuccessNotification("Filial ble oppdatert!"),
      onError: () => showErrorNotification("Klarte ikke oppdatere filial!"),
    }),
  );

  const form = useAppForm({
    defaultValues: {
      localName: branch.localName ?? "",
      parentBranch: branch.parentBranch ?? "",
      childBranches: branch.childBranches ?? [],
      childLabel: branch.childLabel ?? "",
    },
    onSubmit: ({ value }) =>
      updateRelationshipsMutation.mutate({
        body: {
          id: branch.id,
          ...value,
        },
      }),
  });

  return (
    <Stack>
      <form.AppField name="localName">
        {(field) => <field.TextField label="Lokalt navn" placeholder="Flåklypa" />}
      </form.AppField>
      <form.AppField name="parentBranch">
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
      <form.AppField name="childBranches">
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
