import type { QuestionAndAnswer } from "@boklisten/backend/shared/question-and-answer";
import { Button, Group, Stack } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAppForm } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

export default function QuestionAndAnswerEditor({
  questionAndAnswer,
  onClose,
}: {
  questionAndAnswer?: QuestionAndAnswer | undefined;
  onClose: () => void;
}) {
  const form = useAppForm({
    defaultValues: {
      question: questionAndAnswer?.question ?? "",
      answer: questionAndAnswer?.answer ?? "",
    },
    onSubmit: ({ value }) => {
      if (questionAndAnswer === undefined) {
        addQuestionAndAnswerMutation.mutate({ body: value });
      } else {
        updateQuestionAndAnswerMutation.mutate({
          params: { id: questionAndAnswer.id },
          body: value,
        });
      }
    },
  });

  const queryClient = useQueryClient();
  const { api } = useApiClient();

  const addQuestionAndAnswerMutation = useMutation(
    api.questionsAndAnswers.store.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: api.questionsAndAnswers.getAll.queryKey(),
        }),
      onSuccess: () => {
        showSuccessNotification("Spørsmål og svar ble lagret!");
        onClose();
      },
      onError: () => showErrorNotification("Klarte ikke lagre spørsmål og svar!"),
    }),
  );

  const updateQuestionAndAnswerMutation = useMutation(
    api.questionsAndAnswers.update.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: api.questionsAndAnswers.getAll.pathKey(),
        }),
      onSuccess: () => {
        showSuccessNotification("Dynamisk innhold ble oppdatert!");
        onClose();
      },
      onError: () => showErrorNotification("Klarte ikke oppdatere dynamisk innhold!"),
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
      <Group>
        <Button variant="subtle" onClick={() => onClose()}>
          Avbryt
        </Button>
        <Button
          loading={
            addQuestionAndAnswerMutation.isPending || updateQuestionAndAnswerMutation.isPending
          }
          onClick={form.handleSubmit}
        >
          {questionAndAnswer === undefined ? "Opprett" : "Lagre"}
        </Button>
      </Group>
    </Stack>
  );
}
