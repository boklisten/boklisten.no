import type { QuestionAndAnswer } from "@boklisten/backend/shared/question-and-answer";
import { ActionIcon, Box, Button, Group, Stack, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AG_GRID_LOCALE_NO } from "@ag-grid-community/locale";
import type { ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import QuestionAndAnswerEditor from "@/features/questions-and-answers/QuestionAndAnswerEditor";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

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

  const { mutate: updateOrder, isPending: isReordering } = useMutation(
    api.questionsAndAnswers.updateOrder.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: api.questionsAndAnswers.getAll.pathKey(),
        }),
      onError: () => showErrorNotification("Klarte ikke endre rekkefølgen!"),
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
            { field: "question", headerName: "Spørsmål", rowDrag: true },
            { field: "answer", headerName: "Svar" },
            {
              headerName: "Handlinger",
              pinned: "right",
              width: 110,
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
          defaultColDef={{ flex: 1, sortable: false, filter: false }}
          getRowId={({ data }) => data.id}
          localeText={AG_GRID_LOCALE_NO}
          loading={isLoading || isDestroying || isReordering}
          rowDragManaged
          onRowDragEnd={({ api }) => {
            const ids: number[] = [];
            api.forEachNodeAfterFilterAndSort(({ data }) => {
              if (data) ids.push(Number(data.id));
            });
            updateOrder({ body: { ids } });
          }}
        />
      </Box>
    </Stack>
  );
}
