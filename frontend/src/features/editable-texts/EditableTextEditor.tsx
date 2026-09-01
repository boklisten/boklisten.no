import { Button, Group, Stack } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAppForm } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";
import type { Route } from "@tuyau/core/types";

export default function EditableTextEditor({
  editableText,
  onClose,
}: {
  editableText?: Route.Response<"editable_texts.get_all">[number] | undefined;
  onClose: () => void;
}) {
  const form = useAppForm({
    defaultValues: {
      id: editableText?.id ?? "",
      text: editableText?.text ?? "",
    },
    onSubmit: ({ value }) => {
      upsertEditableTextMutation.mutate({
        params: { id: editableText?.id ?? value.id },
        body: {
          text: value.text,
        },
      });
    },
  });

  const queryClient = useQueryClient();
  const { api } = useApiClient();

  const upsertEditableTextMutation = useMutation(
    api.editableTexts.upsert.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: api.editableTexts.getAll.pathKey(),
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
            description="Unik nøkkel kan ikke endres etter opprettelse"
            placeholder="min_nye_nokkel"
            disabled={editableText !== undefined}
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
        <Button loading={upsertEditableTextMutation.isPending} onClick={form.handleSubmit}>
          {editableText === undefined ? "Opprett" : "Lagre"}
        </Button>
      </Group>
    </Stack>
  );
}
