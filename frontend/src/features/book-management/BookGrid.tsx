import type { Item } from "@boklisten/backend/shared/item";
import { ActionIcon, Box, Switch, Tooltip } from "@mantine/core";
import { IconEdit } from "@tabler/icons-react";
import { AG_GRID_LOCALE_NO } from "@ag-grid-community/locale";
import type {
  ColDef,
  ICellRendererParams,
  NewValueParams,
  SelectionChangedEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import type { ReactNode, RefObject } from "react";

export type BookPatch = Partial<Pick<Item, "price" | "active" | "buyback">>;
export interface BookPatchRequest {
  id: string;
  patch: BookPatch;
}

function CenteredCell({ children }: { children: ReactNode }) {
  return (
    <Box h="100%" display="flex" style={{ alignItems: "center" }}>
      {children}
    </Box>
  );
}

const YES = "Ja";
const NO = "Nei";

/** The grid opens showing only active books; the Aktiv column menu clears the filter. */
const DEFAULT_FILTER_MODEL = {
  active: { filterType: "text", type: "equals", filter: YES },
};

function switchColumn(
  field: "active" | "buyback",
  headerName: string,
  onPatch: (request: BookPatchRequest) => void,
): ColDef<Item> {
  return {
    field,
    headerName,
    width: 110,
    flex: 0,
    cellDataType: "boolean",
    filter: "agTextColumnFilter",
    filterValueGetter: ({ data }) => (data?.[field] ? YES : NO),
    filterParams: {
      filterOptions: ["equals"],
      maxNumConditions: 1,
      filterPlaceholder: `${YES} eller ${NO}`,
      buttons: ["reset"],
    },
    cellRenderer: ({ data, value }: ICellRendererParams<Item, boolean>) =>
      data && (
        <CenteredCell>
          <Switch
            aria-label={`${headerName}: ${data.title}`}
            checked={value ?? false}
            onChange={(event) =>
              onPatch({ id: data.id, patch: { [field]: event.currentTarget.checked } })
            }
          />
        </CenteredCell>
      ),
  };
}

export default function BookGrid({
  gridRef,
  items,
  loading,
  onPatch,
  onEdit,
  onSelectionChange,
}: {
  gridRef: RefObject<AgGridReact<Item> | null>;
  items: Item[];
  loading: boolean;
  onPatch: (request: BookPatchRequest) => void;
  onEdit: (item: Item) => void;
  onSelectionChange: (selected: Item[]) => void;
}) {
  const columnDefs: ColDef<Item>[] = [
    { field: "title", headerName: "Tittel", flex: 2, minWidth: 220 },
    {
      colId: "isbn",
      headerName: "ISBN",
      width: 150,
      flex: 0,
      cellDataType: "text",
      valueGetter: ({ data }) => (data ? String(data.info.isbn) : ""),
    },
    { field: "info.subject", headerName: "Fag", flex: 1, minWidth: 160 },
    { field: "info.year", headerName: "Utgitt", width: 100, flex: 0, cellDataType: "number" },
    {
      field: "price",
      headerName: "Pris",
      width: 120,
      flex: 0,
      cellDataType: "number",
      type: "rightAligned",
      editable: true,
      singleClickEdit: true,
      cellEditor: "agNumberCellEditor",
      cellEditorParams: { min: 0, precision: 0, showStepperButtons: false },
      valueFormatter: ({ value }) => (typeof value === "number" ? `${value} kr` : ""),
      onCellValueChanged: ({ data, oldValue, newValue }: NewValueParams<Item, number>) => {
        if (typeof newValue === "number" && newValue !== oldValue) {
          onPatch({ id: data.id, patch: { price: newValue } });
        }
      },
    },
    switchColumn("active", "Aktiv", onPatch),
    switchColumn("buyback", "Kjøpes inn", onPatch),
    {
      colId: "edit",
      headerName: "",
      pinned: "right",
      width: 60,
      flex: 0,
      sortable: false,
      filter: false,
      resizable: false,
      cellRenderer: ({ data }: ICellRendererParams<Item>) =>
        data && (
          <CenteredCell>
            <Tooltip label="Endre bok">
              <ActionIcon
                aria-label={`Endre ${data.title}`}
                variant="subtle"
                onClick={() => onEdit(data)}
              >
                <IconEdit />
              </ActionIcon>
            </Tooltip>
          </CenteredCell>
        ),
    },
  ];

  return (
    <Box h="calc(100vh - 260px)" mih={420}>
      <AgGridReact<Item>
        ref={gridRef}
        rowData={items}
        columnDefs={columnDefs}
        defaultColDef={{ flex: 1, sortable: true, filter: true }}
        getRowId={({ data }) => data.id}
        initialState={{ filter: { filterModel: DEFAULT_FILTER_MODEL } }}
        rowSelection={{
          mode: "multiRow",
          selectAll: "filtered",
          enableClickSelection: false,
          headerCheckbox: true,
        }}
        selectionColumnDef={{ width: 48, pinned: "left" }}
        onSelectionChanged={(event: SelectionChangedEvent<Item>) =>
          onSelectionChange(event.api.getSelectedRows())
        }
        localeText={AG_GRID_LOCALE_NO}
        loading={loading}
        enterNavigatesVertically
        enterNavigatesVerticallyAfterEdit
        stopEditingWhenCellsLoseFocus
        pagination
        paginationPageSize={50}
        paginationPageSizeSelector={[50, 100, 200, 1000]}
      />
    </Box>
  );
}
