import type { InvoiceListRow } from "@boklisten/backend/shared/invoice";
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

import {
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  formatDate,
  formatKroner,
  invoiceKindLabel,
  parseInvoiceStatus,
} from "@/features/invoices/invoiceLabels";

const SELECTION_COLUMN_ID = "ag-Grid-SelectionColumn";

function StatusCell({ value }: ICellRendererParams<InvoiceListRow, InvoiceListRow["status"]>) {
  return (
    value && (
      <Box h="100%" display="flex" style={{ alignItems: "center" }}>
        <Badge variant="light" color={INVOICE_STATUS_COLORS[value]} radius="sm" tt="none" fw={600}>
          {INVOICE_STATUS_LABELS[value]}
        </Badge>
      </Box>
    )
  );
}

/**
 * The invoice list. With `onSelectionChange` the rows get checkboxes for picking invoices to
 * export; without it the grid is read-only, as in the generation preview.
 */
export default function InvoiceGrid({
  rows,
  loading,
  height = "calc(100vh - 340px)",
  onOpen,
  onSelectionChange,
}: {
  rows: InvoiceListRow[];
  loading: boolean;
  height?: string;
  onOpen?: (invoiceId: string) => void;
  onSelectionChange?: (invoiceIds: string[]) => void;
}) {
  const narrow = useMediaQuery("(max-width: 48em)");
  const columnDefs: ColDef<InvoiceListRow>[] = [
    { field: "invoiceId", headerName: "Nr", width: 120, flex: 0, cellDataType: "text" },
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
      headerName: "Status",
      width: 130,
      flex: 0,
      cellRenderer: StatusCell,
      valueFormatter: ({ value }) => {
        const status = parseInvoiceStatus(value);
        return status ? INVOICE_STATUS_LABELS[status] : "";
      },
    },
  ];

  const onCellClicked = (event: CellClickedEvent<InvoiceListRow>) => {
    if (event.column.getColId() !== SELECTION_COLUMN_ID && event.data && onOpen) {
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
