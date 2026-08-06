import type { QuestionAndAnswer } from "@boklisten/backend/shared/question-and-answer";
import { ActionIcon, Button, Group, Stack, Tooltip, Box } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AG_GRID_LOCALE_NO } from "@ag-grid-community/locale";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import QuestionAndAnswerEditor from "@/features/questions-and-answers/QuestionAndAnswerEditor";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

const defaultColDef: ColDef = { flex: 1, sortable: true, filter: true };
function openEditorModal(questionAndAnswer?: QuestionAndAnswer) {
  const modalId = modals.open({
    title: questionAndAnswer === undefined ? "Legg til spørsmål og svar" : "Endre spørsmål og svar",
    size: "xl",
    children: (
      <QuestionAndAnswerEditor
        questionAndAnswer={questionAndAnswer}
        onClose={() => modals.close(modalId)}
      />
    ),
  });
}

export default function QuestionsAndAnswersTable() {
  const { api } = useApiClient();
  const queryClient = useQueryClient();

  const { mutate: destroyQuestionAndAnswer, isPending: isDestroying } = useMutation(
    api.questionsAndAnswers.destroy.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: api.questionsAndAnswers.getAll.pathKey(),
        }),
      onSuccess: () => showSuccessNotification("Spørsmål og svar ble slettet!"),
      onError: () => showErrorNotification("Klarte ikke slette spørsmål og svar!"),
    }),
  );

  const {
    data: questionsAndAnswers,
    isLoading,
    error,
  } = useQuery(api.questionsAndAnswers.getAll.queryOptions({}));

  if (error) {
    return (
      <ErrorAlert title={"Klarte ikke laste inn spørsmål og svar"}>
        {PLEASE_TRY_AGAIN_TEXT}
      </ErrorAlert>
    );
  }

  return (
    <Stack>
      <Group>
        <Button onClick={() => openEditorModal()}>Legg til</Button>
      </Group>
      <Box h={500}>
        <AgGridReact<QuestionAndAnswer>
          rowData={questionsAndAnswers ?? []}
          columnDefs={[
            { field: "question", headerName: "Spørsmål" },
            { field: "answer", headerName: "Svar" },
            {
              headerName: "Handlinger",
              pinned: "right",
              width: 110,
              sortable: false,
              filter: false,
              resizable: false,
              flex: 0,
              cellRenderer: ({ data }: ICellRendererParams<QuestionAndAnswer>) =>
                data && (
                  <Group gap={"xs"} h={"100%"} align={"center"} wrap={"nowrap"}>
                    <Tooltip label={"Endre"}>
                      <ActionIcon variant={"subtle"} onClick={() => openEditorModal(data)}>
                        <IconEdit />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={"Slett"}>
                      <ActionIcon
                        variant={"subtle"}
                        color={"red"}
                        onClick={() => destroyQuestionAndAnswer({ params: { id: data.id } })}
                      >
                        <IconTrash />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                ),
            },
          ]}
          defaultColDef={defaultColDef}
          getRowId={({ data }) => data.id}
          localeText={AG_GRID_LOCALE_NO}
          loading={isLoading || isDestroying}
          pagination
          paginationPageSize={20}
        />
      </Box>
    </Stack>
  );
}
