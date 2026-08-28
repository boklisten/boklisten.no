import { Button, Card, Group, Skeleton, Stack, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity } from "react";

import { BranchItemCreationModal } from "@/features/branches/BranchItemCreationModal";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import { useAppForm } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

export default function BranchItemSettings({ branchId }: { branchId: string }) {
  const { api } = useApiClient();
  const queryClient = useQueryClient();
  const {
    data: branchItems,
    isLoading,
    isError,
  } = useQuery(api.branchItems.getBranchItems.queryOptions({ params: { branchId } }));

  const saveMutation = useMutation(
    api.branchItems.setBranchItems.mutationOptions({
      onSuccess: () => showSuccessNotification("Endringene ble lagret!"),
      onError: () => showErrorNotification("Klarte ikke lagre endringene"),
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: api.branchItems.getBranchItems.pathKey(),
        }),
    }),
  );

  const subjects = new Set(branchItems?.flatMap((branchItem) => branchItem.subjects) ?? [])
    .values()
    .toArray()
    .filter((v) => v !== undefined)
    .toSorted((a, b) => a.localeCompare(b));

  const form = useAppForm({
    defaultValues: {
      branchItems: branchItems ?? [],
    },
    onSubmit: ({ value }) =>
      saveMutation.mutate({
        body: {
          branchId,
          branchItems: value.branchItems,
        },
      }),
  });

  const modalId = "create-branch-items";
  return (
    <Stack>
      <Group>
        <Button
          leftSection={<IconPlus />}
          onClick={() =>
            modals.open({
              modalId,
              title: "Legg til bøker",
              children: (
                <BranchItemCreationModal
                  modalId={modalId}
                  onConfirm={(selectedBranchItems) => {
                    modals.close(modalId);
                    const newBranchItems = selectedBranchItems;
                    for (const branchItem of form.state.values.branchItems) {
                      if (newBranchItems.some((nbi) => nbi.item.id === branchItem.item.id))
                        continue;

                      newBranchItems.push(branchItem);
                    }
                    newBranchItems.sort((a, b) => a.item.title.localeCompare(b.item.title));
                    form.setFieldValue("branchItems", newBranchItems);
                  }}
                />
              ),
            })
          }
        >
          Legg til
        </Button>
        <Button bg={"green"} onClick={form.handleSubmit} loading={saveMutation.isPending}>
          Lagre
        </Button>
      </Group>
      <Activity mode={isLoading ? "visible" : "hidden"}>
        <Skeleton height={280} />
        <Skeleton height={280} />
        <Skeleton height={280} />
        <Skeleton height={280} />
        <Skeleton height={280} />
      </Activity>
      <Activity mode={!isLoading && (isError || branchItems == undefined) ? "visible" : "hidden"}>
        <ErrorAlert title={"Klarte ikke laste inn åpningstider"}>
          {PLEASE_TRY_AGAIN_TEXT}
        </ErrorAlert>
      </Activity>
      <form.Subscribe selector={(state) => state.values.branchItems}>
        {(field) => (
          <Activity mode={field.length === 0 ? "visible" : "hidden"}>
            <InfoAlert title={"Ingen bøker"}>
              Denne filialen har ikke tilknyttet noen bøker
            </InfoAlert>
          </Activity>
        )}
      </form.Subscribe>
      <form.AppField name="branchItems" mode="array">
        {(field) =>
          field.state.value.map((branchItem, i) => (
            <Card key={`branch_item-${i}`} withBorder>
              <Stack>
                <Group justify={"space-between"}>
                  <Title order={3}>{branchItem.item.title}</Title>
                  <Button
                    bg={"red"}
                    onClick={() =>
                      field.setValue(
                        field.state.value.filter((v) => v.item.id !== branchItem.item.id),
                      )
                    }
                  >
                    Fjern
                  </Button>
                </Group>
                <Group gap={100}>
                  <Stack>
                    <Title order={4}>Bestilling</Title>
                    <form.AppField name={`branchItems[${i}].rent`}>
                      {(subField) => <subField.SwitchField label={"Lån"} />}
                    </form.AppField>
                    <form.AppField name={`branchItems[${i}].partlyPayment`}>
                      {(subField) => <subField.SwitchField label={"Delbetaling"} />}
                    </form.AppField>
                    <form.AppField name={`branchItems[${i}].buy`}>
                      {(subField) => <subField.SwitchField label={"Salg"} />}
                    </form.AppField>
                  </Stack>
                  <Stack>
                    <Title order={4}>På filial</Title>
                    <form.AppField name={`branchItems[${i}].rentAtBranch`}>
                      {(subField) => <subField.SwitchField label={"Lån"} />}
                    </form.AppField>
                    <form.AppField name={`branchItems[${i}].partlyPaymentAtBranch`}>
                      {(subField) => <subField.SwitchField label={"Delbetaling"} />}
                    </form.AppField>
                    <form.AppField name={`branchItems[${i}].buyAtBranch`}>
                      {(subField) => <subField.SwitchField label={"Salg"} />}
                    </form.AppField>
                  </Stack>
                </Group>
                <form.AppField name={`branchItems[${i}].subjects`}>
                  {(subField) => (
                    <subField.TagsField label={"Fag"} placeholder={"Velg fag"} data={subjects} />
                  )}
                </form.AppField>
              </Stack>
            </Card>
          ))
        }
      </form.AppField>
    </Stack>
  );
}
