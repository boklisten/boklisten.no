import { ActionIcon, Box, Button, Group, Stack, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AG_GRID_LOCALE_NO } from "@ag-grid-community/locale";
import type { ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Route } from "@tuyau/core/types";

import EditableTextEditor from "@/features/editable-texts/EditableTextEditor";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

type EditableText = Route.Response<"editable_texts.get_all">[number];

function openEditorModal(editableText?: EditableText) {
  const modalId = modals.open({
    title: editableText === undefined ? "Legg til dynamisk innhold" : "Endre dynamisk innhold",
    size: "xl",
    children: (
      <EditableTextEditor editableText={editableText} onClose={() => modals.close(modalId)} />
    ),
  });
}

export default function EditableTextTable() {
  const { api } = useApiClient();
  const queryClient = useQueryClient();

  const { mutate: destroyEditableText, isPending: isDestroying } = useMutation(
    api.editableTexts.destroy.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: api.editableTexts.getAll.queryKey(),
        }),
      onSuccess: () => showSuccessNotification("Dynamisk innhold ble slettet!"),
      onError: () => showErrorNotification("Klarte ikke slette dynamisk innhold!"),
    }),
  );

  const {
    data: editableTexts,
    isLoading,
    error,
  } = useQuery(api.editableTexts.getAll.queryOptions({}));

  if (error) {
    return (
      <ErrorAlert title={"Klarte ikke laste inn dynamisk innhold"}>
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
        <AgGridReact<EditableText>
          rowData={editableTexts ?? []}
          columnDefs={[
            { field: "id", headerName: "Unik nøkkel" },
            {
              headerName: "Handlinger",
              pinned: "right",
              width: 110,
              sortable: false,
              filter: false,
              resizable: false,
              flex: 0,
              cellRenderer: ({ data }: ICellRendererParams<EditableText>) =>
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
                        onClick={() =>
                          modals.openConfirmModal({
                            title: "Bekreft sletting av dynamisk innhold",
                            children:
                              "Hvis du sletter dette innholdet, vil sider som bruker denne teksten slutte å fungere. Sjekk at ingen sider er avhengige av denne nøkkelen før du fortsetter.",
                            confirmProps: { color: "red" },
                            labels: { cancel: "Avbryt", confirm: "Slett" },
                            onConfirm: () => destroyEditableText({ params: { id: data.id } }),
                          })
                        }
                      >
                        <IconTrash />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                ),
            },
          ]}
          defaultColDef={{ flex: 1, sortable: true, filter: true }}
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
