import type {
  InvoiceExportFormat,
  InvoiceListRow,
  InvoiceStatus,
} from "@boklisten/backend/shared/invoice";
import {
  INVOICE_EXPORT_FORMATS,
  INVOICE_STATUSES,
  invoiceBatchPrefix,
} from "@boklisten/backend/shared/invoice";
import {
  Affix,
  Button,
  Divider,
  Group,
  Menu,
  MultiSelect,
  Paper,
  Pill,
  Stack,
  Text,
  TextInput,
  Transition,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconChevronDown, IconFileDownload, IconSearch } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import InvoiceDetailDrawer from "@/features/invoices/InvoiceDetailDrawer";
import InvoiceGrid from "@/features/invoices/InvoiceGrid";
import InvoiceStatusControl from "@/features/invoices/InvoiceStatusControl";
import InvoiceStatusSummary from "@/features/invoices/InvoiceStatusSummary";
import { invoiceBatches } from "@/features/invoices/invoiceBatches";
import {
  EXPORT_FORMAT_LABELS,
  batchLabel,
  batchPillLabel,
  formatKroner,
} from "@/features/invoices/invoiceLabels";
import { joinBatchPrefixes, parseBatchPrefixes } from "@/features/invoices/invoiceParams";
import useInvoiceStatusChange from "@/features/invoices/useInvoiceStatusChange";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { downloadTextFile } from "@/shared/utils/downloadTextFile";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification } from "@/shared/utils/notifications";

const route = getRouteApi("/(administrasjon)/admin/faktura");

/** Rounds shown as pills in the picker before the rest collapse into "+n til". */
const MAX_BATCH_PILLS = { narrow: 2, wide: 3 };

/** The status every selected invoice shares, or null when the selection is mixed. */
function commonStatus(rows: InvoiceListRow[]): InvoiceStatus | null {
  const [first, ...rest] = rows;
  return first && rest.every((row) => row.status === first.status) ? first.status : null;
}

/**
 * Every invoice is loaded once; the round picker, the status tiles and the search all narrow
 * the list client-side.
 */
export default function InvoiceOverview() {
  const { api, client } = useApiClient();
  const { fakturarunde, faktura } = route.useSearch();
  const navigate = route.useNavigate();
  const narrow = useMediaQuery("(max-width: 48em)") ?? false;
  const [statuses, setStatuses] = useState<InvoiceStatus[]>([...INVOICE_STATUSES]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const statusChange = useInvoiceStatusChange();

  const invoices = useQuery(api.invoices.list.queryOptions());
  const allRows = invoices.data ?? [];
  const batches = useMemo(() => invoiceBatches(invoices.data ?? []), [invoices.data]);
  const selectedBatches = parseBatchPrefixes(fakturarunde);
  const maxPills = narrow ? MAX_BATCH_PILLS.narrow : MAX_BATCH_PILLS.wide;

  const exportInvoices = useMutation({
    mutationFn: (format: InvoiceExportFormat) =>
      client.api.invoices.export({ body: { invoiceIds: selectedIds, format } }),
    onSuccess: (file) => downloadTextFile(file.filename, file.csv),
    onError: (error) => showErrorNotification(errorMessage(error, "Klarte ikke lage eksportfilen")),
  });

  const selectBatches = (prefixes: string[]) =>
    void navigate({
      search: (previous) => ({
        ...previous,
        fakturarunde: joinBatchPrefixes(prefixes),
        faktura: undefined,
      }),
    });
  const openInvoice = (invoiceId: string | undefined) =>
    void navigate({ search: (previous) => ({ ...previous, faktura: invoiceId }), replace: true });

  if (invoices.error) {
    return <ErrorAlert title="Klarte ikke laste inn fakturaer">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>;
  }

  const rows =
    selectedBatches.length === 0
      ? allRows
      : allRows.filter((row) => selectedBatches.includes(invoiceBatchPrefix(row.invoiceId)));
  const visibleRows = rows.filter((row) => statuses.includes(row.status));
  const selectedRows = rows.filter((row) => selectedIds.includes(row.id));
  const selectedTotal = selectedRows.reduce((sum, row) => sum + row.totalIncludingFee, 0);

  return (
    <Stack>
      <MultiSelect
        label="Fakturarunde"
        placeholder={
          invoices.isLoading ? "Laster …" : selectedBatches.length === 0 ? "Alle runder" : ""
        }
        data={batches.map((batch) => ({ value: batch.prefix, label: batchLabel(batch) }))}
        value={selectedBatches}
        onChange={selectBatches}
        searchable
        clearable
        clearButtonProps={{ "aria-label": "Vis alle runder" }}
        renderPill={({ value, onRemove, disabled }) => {
          const index = selectedBatches.indexOf(value ?? "");
          if (index < maxPills) {
            // The rows may still be loading for prefixes that came from the URL.
            const batch = batches.find((candidate) => candidate.prefix === value);
            return (
              <Pill withRemoveButton={!disabled} onRemove={onRemove}>
                {batch ? batchPillLabel(batch) : value}
              </Pill>
            );
          }
          return index === maxPills ? <Pill>+{selectedBatches.length - maxPills} til</Pill> : null;
        }}
        w={{ base: "100%", sm: 520 }}
      />
      <TextInput
        aria-label="Søk i fakturaene"
        placeholder="Søk på nummer, kunde eller beløp"
        leftSection={<IconSearch size={18} />}
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
        w={{ base: "100%", sm: 520 }}
      />
      <InvoiceStatusSummary rows={rows} active={statuses} onChange={setStatuses} />
      <InvoiceGrid
        rows={visibleRows}
        loading={invoices.isLoading}
        showBatch={selectedBatches.length !== 1}
        statusBusy={statusChange.pending}
        quickFilterText={search}
        onOpen={openInvoice}
        onSelectionChange={setSelectedIds}
        onStatusChange={(row, status) => void statusChange.change([row], status)}
      />
      <Text size="sm" c="dimmed">
        Klikk på en faktura for å se detaljer, huk av for å endre eller eksportere flere samtidig.
      </Text>

      <Affix position={{ bottom: 16, left: 0, right: 0 }} zIndex={150}>
        <Transition transition="slide-up" mounted={selectedRows.length > 0}>
          {(style) => (
            <Group justify="center" style={style} px="md">
              <Paper shadow="lg" radius="lg" withBorder px="md" py="xs">
                <Group gap="md" wrap={narrow ? "wrap" : "nowrap"} justify="center">
                  <Stack gap={0} style={{ whiteSpace: "nowrap" }}>
                    <Text fw={600} size="sm">
                      {selectedRows.length} valgt
                    </Text>
                    <Text size="xs" c="dimmed" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatKroner(selectedTotal)}
                    </Text>
                  </Stack>
                  {!narrow && <Divider orientation="vertical" />}
                  <InvoiceStatusControl
                    value={commonStatus(selectedRows)}
                    compact={narrow}
                    size={narrow ? "xs" : "sm"}
                    disabled={statusChange.pending}
                    onChange={(status) => void statusChange.change(selectedRows, status)}
                    ariaLabel="Status for valgte fakturaer"
                    dropdownZIndex={200}
                  />
                  {!narrow && <Divider orientation="vertical" />}
                  <Menu position="top" shadow="md" withinPortal>
                    <Menu.Target>
                      <Button
                        size="compact-md"
                        variant="light"
                        leftSection={<IconFileDownload size={16} />}
                        rightSection={<IconChevronDown size={14} />}
                        loading={exportInvoices.isPending}
                      >
                        Eksporter
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Label>Format</Menu.Label>
                      {INVOICE_EXPORT_FORMATS.map((format) => (
                        <Menu.Item key={format} onClick={() => exportInvoices.mutate(format)}>
                          {EXPORT_FORMAT_LABELS[format]}
                        </Menu.Item>
                      ))}
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Paper>
            </Group>
          )}
        </Transition>
      </Affix>

      <InvoiceDetailDrawer invoiceId={faktura} onClose={() => openInvoice(undefined)} />
    </Stack>
  );
}
