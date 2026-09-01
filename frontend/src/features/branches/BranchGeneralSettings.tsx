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
    api.branches.add.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: api.branches.getAll.pathKey(),
        }),
      onSuccess: async (newBranch) => {
        showSuccessNotification("Filial ble opprettet!");
        await queryClient.invalidateQueries({
          queryKey: api.branches.getAll.pathKey(),
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
      location: {
        region: existingBranch?.location.region ?? "",
        address: existingBranch?.location.address ?? "",
      },
      type: existingBranch?.type ?? null,
      active: existingBranch?.active ?? false,
      isBranchItemsLive: {
        online: existingBranch?.isBranchItemsLive?.online ?? false,
        atBranch: existingBranch?.isBranchItemsLive?.atBranch ?? false,
      },
    },
    onSubmit: ({ value }) =>
      !existingBranch
        ? addBranchMutation.mutate({ body: value })
        : updateBranchMutation.mutate({ body: { id: existingBranch.id, ...value } }),
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
      <form.AppField name="location.region">
        {(field) => <field.TextField required label="Region" placeholder="Oslo, Trondheim, Ski" />}
      </form.AppField>
      <form.AppField name="location.address">
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
        <form.AppField name="isBranchItemsLive.online">
          {(field) => <field.SwitchField label="Synlig for kunder" />}
        </form.AppField>
        <form.AppField name="isBranchItemsLive.atBranch">
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
