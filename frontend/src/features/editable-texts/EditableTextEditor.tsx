import { Button, Group, Stack, TextInput } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAppForm } from "@/shared/hooks/form";
import useAutoSave from "@/shared/hooks/useAutoSave";
import { api, apiClient } from "@/shared/utils/apiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";
import type { Route } from "@tuyau/core/types";

export type EditableText = Route.Response<"editable_texts.index">[number];

const KEY_DESCRIPTION = "Unik nøkkel kan ikke endres etter opprettelse";

/** An existing text, auto-saved (see `useAutoSave`); its key cannot change. */
export function EditEditableText({ editableText }: { editableText: EditableText }) {
  const form = useAppForm(
    useAutoSave({
      defaultValues: { text: editableText.text ?? "" },
      persist: (values) =>
        apiClient.api.editableTexts.upsert({ params: { id: editableText.id }, body: values }),
      invalidates: [api.editableTexts.index.pathKey()],
    }),
  );

  return (
    <Stack>
      <TextInput
        label="Unik nøkkel"
        description={KEY_DESCRIPTION}
        value={editableText.id}
        disabled
      />
      <form.AppField name="text">
        {(field) => <field.RichTextEditorField label="Tekst" />}
      </form.AppField>
    </Stack>
  );
}

export function CreateEditableText({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const upsertMutation = useMutation(
    api.editableTexts.upsert.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: api.editableTexts.index.pathKey(),
        }),
      onSuccess: () => {
        showSuccessNotification("Dynamisk innhold ble lagret!");
        onClose();
      },
      onError: () =>
        showErrorNotification({
          title: "Klarte ikke lagre dynamisk innhold!",
          message:
            'Vennligst sjekk at unik nøkkel er formattert riktig. [a-z] og "_" for mellomrom.',
        }),
    }),
  );
  const form = useAppForm({
    defaultValues: { id: "", text: "" },
    onSubmit: ({ value }) =>
      upsertMutation.mutate({ params: { id: value.id }, body: { text: value.text } }),
  });

  return (
    <Stack>
      <form.AppField
        name="id"
        validators={{
          onChange: ({ value }) => (value.length === 0 ? "Du fylle inn unik nøkkel" : null),
        }}
      >
        {(field) => (
          <field.TextField
            label="Unik nøkkel"
            description={KEY_DESCRIPTION}
            placeholder="min_nye_nokkel"
          />
        )}
      </form.AppField>
      <form.AppField name="text">
        {(field) => <field.RichTextEditorField label="Tekst" />}
      </form.AppField>
      <Group>
        <Button variant="subtle" onClick={() => onClose()}>
          Avbryt
        </Button>
        <Button loading={upsertMutation.isPending} onClick={form.handleSubmit}>
          Opprett
        </Button>
      </Group>
    </Stack>
  );
}
