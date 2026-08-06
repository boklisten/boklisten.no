import type { Branch } from "@boklisten/backend/shared/branch";
import type { Item } from "@boklisten/backend/shared/item";
import { ActionIcon, Button, Group, Stack, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconTrash } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AG_GRID_LOCALE_NO } from "@ag-grid-community/locale";
import type { ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Route } from "@tuyau/core/types";

import CreateWaitingListEntry from "@/features/waiting-list/CreateWaitingListEntry";
import useApiClient from "@/shared/hooks/useApiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

type WaitingListEntry = Route.Response<"waiting_list_customer.get_all">[number];

export default function WaitingListTable({
  loading,
  items,
  branches,
  waitingList,
}: {
  loading: boolean;
  items: Item[];
  branches: Branch[];
  waitingList: Route.Response<"waiting_list_customer.get_all">;
}) {
  const { api } = useApiClient();
  const queryClient = useQueryClient();

  const { mutate: destroyWaitingListEntry, isPending: isDestroying } = useMutation(
    api.waitingListCustomer.destroy.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: api.waitingListCustomer.getAll.pathKey(),
        }),
      onSuccess: () => showSuccessNotification("Ventelisteoppføring ble slettet!"),
      onError: () => showErrorNotification("Klarte ikke slette ventelisteoppføring!"),
    }),
  );

  const itemTitleById = new Map(items.map((item) => [item.id, item.title]));
  const branchNameById = new Map(branches.map((branch) => [branch.id, branch.name]));

  return (
    <Stack>
      <Group>
        <Button
          onClick={() => {
            const modalId = modals.open({
              size: "xl",
              children: (
                <CreateWaitingListEntry items={items} onClose={() => modals.close(modalId)} />
              ),
            });
          }}
        >
          Legg til i venteliste
        </Button>
      </Group>
      <div style={{ height: 500 }}>
        <AgGridReact<WaitingListEntry>
          rowData={waitingList}
          columnDefs={[
            { field: "name", headerName: "Navn" },
            { field: "phoneNumber", headerName: "Telefonnummer" },
            {
              headerName: "Bok",
              valueGetter: ({ data }) => (data ? itemTitleById.get(data.itemId) : undefined),
            },
            {
              headerName: "Filial",
              valueGetter: ({ data }) => (data ? branchNameById.get(data.branchId) : undefined),
            },
            {
              headerName: "",
              pinned: "right",
              width: 70,
              sortable: false,
              filter: false,
              resizable: false,
              flex: 0,
              cellRenderer: ({ data }: ICellRendererParams<WaitingListEntry>) =>
                data && (
                  <Group gap={"xs"} h={"100%"} align={"center"} wrap={"nowrap"}>
                    <Tooltip label={"Slett"}>
                      <ActionIcon
                        variant={"subtle"}
                        color={"red"}
                        onClick={() => destroyWaitingListEntry({ params: { id: data.id } })}
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
          loading={loading || isDestroying}
          pagination
          paginationPageSize={20}
        />
      </div>
    </Stack>
  );
}
