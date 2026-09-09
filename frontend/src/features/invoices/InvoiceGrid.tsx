import type { InvoiceListRow, InvoiceStatus } from "@boklisten/backend/shared/invoice";
import { Badge, Box } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { AG_GRID_LOCALE_NO } from "@ag-grid-community/locale";
import type {
  CellClickedEvent,
  ColDef,
  ICellRendererParams,
  SelectionChangedEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import InvoiceStatusControl from "@/features/invoices/InvoiceStatusControl";
import {
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  formatDate,
  formatKroner,
  invoiceKindLabel,
  parseInvoiceStatus,
} from "@/features/invoices/invoiceLabels";

const SELECTION_COLUMN_ID = "ag-Grid-SelectionColumn";
const STATUS_COLUMN_ID = "status";
const BATCH_PREFIX_LENGTH = 5;

interface StatusCellParams extends ICellRendererParams<InvoiceListRow, InvoiceStatus> {
  compact: boolean;
  busy: boolean;
  onStatusChange: ((row: InvoiceListRow, status: InvoiceStatus) => void) | undefined;
}

function StatusCell({ value, data, compact, busy, onStatusChange }: StatusCellParams) {
  if (!value || !data) {
    return null;
  }
  return (
    <Box h="100%" display="flex" style={{ alignItems: "center" }}>
      {onStatusChange ? (
        <InvoiceStatusControl
          value={value}
          compact={compact}
          disabled={busy}
          onChange={(status) => onStatusChange(data, status)}
          ariaLabel={`Status for faktura ${data.invoiceId}`}
        />
      ) : (
        <Badge variant="light" color={INVOICE_STATUS_COLORS[value]} radius="sm" tt="none" fw={600}>
          {INVOICE_STATUS_LABELS[value]}
        </Badge>
      )}
    </Box>
  );
}

/**
 * The invoice list. With `onSelectionChange` the rows get checkboxes for picking invoices to
 * export or update together; with `onStatusChange` the status column becomes editable in place.
 * Without either the grid is read-only, as in the generation preview.
 */
export default function InvoiceGrid({
  rows,
  loading,
  height = "calc(100vh - 340px)",
  showBatch = false,
  statusBusy = false,
  onOpen,
  onSelectionChange,
  onStatusChange,
}: {
  rows: InvoiceListRow[];
  loading: boolean;
  height?: string;
  /** Adds a round column, for when the list spans several rounds. */
  showBatch?: boolean;
  statusBusy?: boolean;
  onOpen?: (invoiceId: string) => void;
  onSelectionChange?: (invoiceIds: string[]) => void;
  onStatusChange?: (row: InvoiceListRow, status: InvoiceStatus) => void;
}) {
  const narrow = useMediaQuery("(max-width: 48em)") ?? false;
  const statusCellParams: Omit<StatusCellParams, keyof ICellRendererParams> = {
    compact: narrow,
    busy: statusBusy,
    onStatusChange,
  };
  const columnDefs: ColDef<InvoiceListRow>[] = [
    { field: "invoiceId", headerName: "Nr", width: 120, flex: 0, cellDataType: "text" },
    {
      colId: "batch",
      headerName: "Runde",
      width: 110,
      flex: 0,
      hide: !showBatch,
      valueGetter: ({ data }) => data?.invoiceId.slice(0, BATCH_PREFIX_LENGTH) ?? "",
    },
    { field: "customerName", headerName: "Kunde", flex: 2, minWidth: 160 },
    {
      colId: "type",
      headerName: "Type",
      width: 120,
      flex: 0,
      hide: narrow,
      valueGetter: ({ data }) =>
        data
          ? invoiceKindLabel({ type: data.type, company: data.organizationNumber !== null })
          : "",
    },
    {
      field: "duedate",
      headerName: "Forfall",
      width: 120,
      flex: 0,
      hide: narrow,
      cellDataType: "text",
      valueFormatter: ({ value }) => formatDate(value),
      comparator: (a: Date, b: Date) => new Date(a).getTime() - new Date(b).getTime(),
    },
    {
      field: "totalIncludingFee",
      headerName: "Beløp",
      width: 120,
      flex: 0,
      cellDataType: "number",
      type: "rightAligned",
      valueFormatter: ({ value }) => (typeof value === "number" ? formatKroner(value) : ""),
      cellStyle: { fontVariantNumeric: "tabular-nums" },
    },
    {
      field: "status",
      colId: STATUS_COLUMN_ID,
      headerName: "Status",
      width: onStatusChange && !narrow ? 400 : 150,
      flex: 0,
      cellRenderer: StatusCell,
      cellRendererParams: statusCellParams,
      valueFormatter: ({ value }) => {
        const status = parseInvoiceStatus(value);
        return status ? INVOICE_STATUS_LABELS[status] : "";
      },
    },
  ];

  const onCellClicked = (event: CellClickedEvent<InvoiceListRow>) => {
    const columnId = event.column.getColId();
    const interactive =
      columnId === SELECTION_COLUMN_ID || (columnId === STATUS_COLUMN_ID && onStatusChange);
    if (!interactive && event.data && onOpen) {
      onOpen(event.data.id);
    }
  };

  return (
    <Box h={height} mih={360}>
      <AgGridReact<InvoiceListRow>
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={{ flex: 1, sortable: true, filter: true, resizable: true }}
        getRowId={({ data }) => data.id}
        localeText={AG_GRID_LOCALE_NO}
        loading={loading}
        rowStyle={onOpen ? { cursor: "pointer" } : undefined}
        onCellClicked={onCellClicked}
        rowSelection={
          onSelectionChange
            ? {
                mode: "multiRow",
                checkboxes: true,
                headerCheckbox: true,
                selectAll: "filtered",
                enableClickSelection: false,
              }
            : undefined
        }
        selectionColumnDef={{ width: 48, pinned: "left" }}
        onSelectionChanged={(event: SelectionChangedEvent<InvoiceListRow>) =>
          onSelectionChange?.(event.api.getSelectedRows().map((row) => row.id))
        }
        pagination
        paginationPageSize={100}
        paginationPageSizeSelector={[50, 100, 500]}
      />
    </Box>
  );
}
