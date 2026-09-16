import type { Branch } from "@boklisten/backend/shared/branch";
import { Button, Stack } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity } from "react";

import useUpdateBranchMutation from "@/features/branches/useUpdateBranchMutation";
import { useAppForm } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";
import { imageFieldValidator } from "@/shared/components/form/fields/complex/ImageField";

export default function BranchGeneralSettings({
  existingBranch,
  onSuccess,
}: {
  existingBranch?: Branch;
  onSuccess?: (newBranch?: Branch) => void;
}) {
  const queryClient = useQueryClient();
  const { api } = useApiClient();

  const addBranchMutation = useMutation(
    api.branches.store.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: api.branches.index.pathKey(),
        }),
      onSuccess: async (newBranch) => {
        showSuccessNotification("Filial ble opprettet!");
        await queryClient.invalidateQueries({
          queryKey: api.branches.index.pathKey(),
        });
        onSuccess?.(newBranch);
      },
      onError: () => showErrorNotification("Klarte ikke opprette filial!"),
    }),
  );
  const updateBranchMutation = useUpdateBranchMutation();

  const form = useAppForm({
    defaultValues: {
      name: existingBranch?.name ?? "",
      logo: existingBranch?.logo ?? "",
      region: existingBranch?.region ?? "",
      address: existingBranch?.address ?? "",
      type: existingBranch?.type ?? null,
      active: existingBranch?.active ?? true,
      branchItemsLiveOnline: existingBranch?.branchItemsLiveOnline ?? false,
      branchItemsLiveAtBranch: existingBranch?.branchItemsLiveAtBranch ?? false,
    },
    onSubmit: ({ value }) => {
      // Empty optional text fields mean "not set".
      const body = { ...value, logo: value.logo || null, address: value.address || null };
      return !existingBranch
        ? addBranchMutation.mutate({ body })
        : updateBranchMutation.mutate({ params: { branchId: existingBranch.id }, body });
    },
  });

  return (
    <Stack>
      <form.AppField name="name">
        {(field) => (
          <field.TextField required label="Navn" placeholder="Flåklypa videregående skole" />
        )}
      </form.AppField>
      <form.AppField
        name="logo"
        validators={{
          onChange: ({ value }) => imageFieldValidator(value),
        }}
      >
        {(field) => <field.ImageField label="Logo" />}
      </form.AppField>
      <form.AppField name="region">
        {(field) => <field.TextField required label="Region" placeholder="Oslo, Trondheim, Ski" />}
      </form.AppField>
      <form.AppField name="address">
        {(field) => <field.TextField label="Adresse" placeholder="Postboks 8, 1316 Eiksmarka" />}
      </form.AppField>
      <form.AppField name="type">
        {(field) => (
          <field.SelectField
            data={["privatist", "VGS"]}
            label="Type"
            placeholder="privatist eller VGS"
            clearable
          />
        )}
      </form.AppField>
      <Activity mode={existingBranch ? "visible" : "hidden"}>
        <form.AppField name="active">
          {(field) => <field.SwitchField label="Aktiv" />}
        </form.AppField>
        <form.AppField name="branchItemsLiveOnline">
          {(field) => <field.SwitchField label="Synlig for kunder" />}
        </form.AppField>
        <form.AppField name="branchItemsLiveAtBranch">
          {(field) => <field.SwitchField label="Synlig for ansatte" />}
        </form.AppField>
      </Activity>
      <form.AppForm>
        <form.ErrorSummary />
      </form.AppForm>
      <Button
        color="green"
        onClick={form.handleSubmit}
        loading={addBranchMutation.isPending || updateBranchMutation.isPending}
      >
        {existingBranch ? "Lagre" : "Opprett"}
      </Button>
    </Stack>
  );
}
