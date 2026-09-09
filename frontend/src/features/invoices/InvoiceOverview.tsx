import type {
  InvoiceExportFormat,
  InvoiceListRow,
  InvoiceStatus,
} from "@boklisten/backend/shared/invoice";
import { INVOICE_EXPORT_FORMATS, INVOICE_STATUSES } from "@boklisten/backend/shared/invoice";
import {
  Affix,
  Button,
  Divider,
  Group,
  Menu,
  MultiSelect,
  Paper,
  Stack,
  Text,
  Transition,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconChevronDown, IconFileDownload } from "@tabler/icons-react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";

import InvoiceDetailDrawer from "@/features/invoices/InvoiceDetailDrawer";
import InvoiceGrid from "@/features/invoices/InvoiceGrid";
import InvoiceStatusControl from "@/features/invoices/InvoiceStatusControl";
import InvoiceStatusSummary from "@/features/invoices/InvoiceStatusSummary";
import { EXPORT_FORMAT_LABELS, batchLabel, formatKroner } from "@/features/invoices/invoiceLabels";
import { joinBatchPrefixes, parseBatchPrefixes } from "@/features/invoices/invoiceParams";
import useInvoiceStatusChange from "@/features/invoices/useInvoiceStatusChange";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { downloadTextFile } from "@/shared/utils/downloadTextFile";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification } from "@/shared/utils/notifications";

const route = getRouteApi("/(administrasjon)/admin/faktura");

/** The status every selected invoice shares, or null when the selection is mixed. */
function commonStatus(rows: InvoiceListRow[]): InvoiceStatus | null {
  const [first, ...rest] = rows;
  return first && rest.every((row) => row.status === first.status) ? first.status : null;
}

export default function InvoiceOverview() {
  const { api, client } = useApiClient();
  const { fakturarunde, faktura } = route.useSearch();
  const navigate = route.useNavigate();
  const narrow = useMediaQuery("(max-width: 48em)") ?? false;
  const [statuses, setStatuses] = useState<InvoiceStatus[]>([...INVOICE_STATUSES]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const statusChange = useInvoiceStatusChange();

  const batches = useQuery(api.invoices.batches.queryOptions());
  const newestBatch = batches.data?.[0]?.prefix;
  const selectedBatches =
    fakturarunde === undefined
      ? newestBatch === undefined
        ? []
        : [newestBatch]
      : parseBatchPrefixes(fakturarunde);
  const invoices = useQueries({
    queries: selectedBatches.map((batch) => api.invoices.list.queryOptions({ query: { batch } })),
    combine: (results) => ({
      rows: results
        .flatMap((result) => result.data ?? [])
        .toSorted((a, b) => a.invoiceId.localeCompare(b.invoiceId)),
      loading: results.some((result) => result.isLoading),
      loaded: results.length > 0 && results.every((result) => result.data !== undefined),
      error: results.find((result) => result.error)?.error,
    }),
  });

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
        fakturarunde: joinBatchPrefixes(prefixes) ?? "",
        faktura: undefined,
      }),
    });
  const openInvoice = (invoiceId: string | undefined) =>
    void navigate({ search: (previous) => ({ ...previous, faktura: invoiceId }), replace: true });

  if (batches.error || invoices.error) {
    return <ErrorAlert title="Klarte ikke laste inn fakturaer">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>;
  }

  const { rows } = invoices;
  const visibleRows = rows.filter((row) => statuses.includes(row.status));
  const selectedRows = rows.filter((row) => selectedIds.includes(row.id));
  const selectedTotal = selectedRows.reduce((sum, row) => sum + row.totalIncludingFee, 0);

  return (
    <Stack>
      <MultiSelect
        label="Fakturarunde"
        placeholder={
          batches.isLoading ? "Laster …" : selectedBatches.length === 0 ? "Velg runde" : ""
        }
        data={(batches.data ?? []).map((candidate) => ({
          value: candidate.prefix,
          label: batchLabel(candidate),
        }))}
        value={selectedBatches}
        onChange={selectBatches}
        searchable
        clearable
        clearButtonProps={{ "aria-label": "Fjern alle runder" }}
        w={{ base: "100%", sm: 520 }}
      />
      <InvoiceStatusSummary rows={rows} active={statuses} onChange={setStatuses} />
      <InvoiceGrid
        rows={visibleRows}
        loading={batches.isLoading || invoices.loading}
        showBatch={selectedBatches.length > 1}
        statusBusy={statusChange.pending}
        onOpen={openInvoice}
        onSelectionChange={setSelectedIds}
        onStatusChange={(row, status) => void statusChange.change([row], status)}
      />
      {selectedBatches.length === 0 && !batches.isLoading ? (
        <Text size="sm" c="dimmed">
          Velg minst én fakturarunde for å se fakturaene.
        </Text>
      ) : (
        invoices.loaded && (
          <Text size="sm" c="dimmed">
            {visibleRows.length} av {rows.length} fakturaer. Klikk på en faktura for å se detaljer,
            huk av for å endre eller eksportere flere samtidig.
          </Text>
        )
      )}

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
