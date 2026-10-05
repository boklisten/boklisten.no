import type { QuestionAndAnswer } from "@boklisten/backend/shared/question-and-answer";
import { Button, Group, Stack } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAppForm } from "@/shared/hooks/form";
import useAutoSave from "@/shared/hooks/useAutoSave";
import { api, apiClient } from "@/shared/utils/apiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

/** An existing question, auto-saved (see `useAutoSave`). */
export function EditQuestionAndAnswer({
  questionAndAnswer,
}: {
  questionAndAnswer: QuestionAndAnswer;
}) {
  const form = useAppForm(
    useAutoSave({
      defaultValues: { question: questionAndAnswer.question, answer: questionAndAnswer.answer },
      persist: (values) =>
        apiClient.api.questionsAndAnswers.update({
          params: { id: questionAndAnswer.id },
          body: values,
        }),
      invalidates: [api.questionsAndAnswers.index.pathKey()],
    }),
  );

  return (
    <Stack>
      <form.AppField name="question">
        {(field) => <field.RichTextEditorField label="Spørsmål" />}
      </form.AppField>
      <form.AppField name="answer">
        {(field) => <field.RichTextEditorField label="Svar" />}
      </form.AppField>
    </Stack>
  );
}

export function CreateQuestionAndAnswer({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const addMutation = useMutation(
    api.questionsAndAnswers.store.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: api.questionsAndAnswers.index.queryKey(),
        }),
      onSuccess: () => {
        showSuccessNotification("Spørsmål og svar ble lagret!");
        onClose();
      },
      onError: () => showErrorNotification("Klarte ikke lagre spørsmål og svar!"),
    }),
  );
  const form = useAppForm({
    defaultValues: { question: "", answer: "" },
    onSubmit: ({ value }) => addMutation.mutate({ body: value }),
  });

  return (
    <Stack>
      <form.AppField name="question">
        {(field) => <field.RichTextEditorField label="Spørsmål" />}
      </form.AppField>
      <form.AppField name="answer">
        {(field) => <field.RichTextEditorField label="Svar" />}
      </form.AppField>
      <Group>
        <Button variant="subtle" onClick={() => onClose()}>
          Avbryt
        </Button>
        <Button loading={addMutation.isPending} onClick={form.handleSubmit}>
          Opprett
        </Button>
      </Group>
    </Stack>
  );
}
