import type { InvoiceExportFormat, InvoiceStatus } from "@boklisten/backend/shared/invoice";
import { INVOICE_EXPORT_FORMATS, INVOICE_STATUSES } from "@boklisten/backend/shared/invoice";
import {
  Affix,
  Button,
  Chip,
  Group,
  Menu,
  Paper,
  Select,
  Stack,
  Text,
  Transition,
} from "@mantine/core";
import { IconChevronDown, IconFileDownload } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";

import InvoiceDetailDrawer from "@/features/invoices/InvoiceDetailDrawer";
import InvoiceGrid from "@/features/invoices/InvoiceGrid";
import {
  EXPORT_FORMAT_LABELS,
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  batchLabel,
  formatKroner,
} from "@/features/invoices/invoiceLabels";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { downloadTextFile } from "@/shared/utils/downloadTextFile";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification } from "@/shared/utils/notifications";

const route = getRouteApi("/(administrasjon)/admin/faktura");

export default function InvoiceOverview() {
  const { api, client } = useApiClient();
  const { fakturarunde, faktura } = route.useSearch();
  const navigate = route.useNavigate();
  const [statuses, setStatuses] = useState<InvoiceStatus[]>([...INVOICE_STATUSES]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const batches = useQuery(api.invoices.batches.queryOptions());
  const batch = fakturarunde ?? batches.data?.[0]?.prefix;
  const invoices = useQuery({
    ...api.invoices.list.queryOptions({ query: { batch: batch ?? "" } }),
    enabled: batch !== undefined,
  });

  const exportInvoices = useMutation({
    mutationFn: (format: InvoiceExportFormat) =>
      client.api.invoices.export({ body: { invoiceIds: selectedIds, format } }),
    onSuccess: (file) => downloadTextFile(file.filename, file.csv),
    onError: (error) => showErrorNotification(errorMessage(error, "Klarte ikke lage eksportfilen")),
  });

  const selectBatch = (prefix: string | null) =>
    void navigate({
      search: (previous) => ({
        ...previous,
        fakturarunde: prefix ?? undefined,
        faktura: undefined,
      }),
    });
  const openInvoice = (invoiceId: string | undefined) =>
    void navigate({ search: (previous) => ({ ...previous, faktura: invoiceId }), replace: true });

  if (batches.error || invoices.error) {
    return <ErrorAlert title="Klarte ikke laste inn fakturaer">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>;
  }

  const rows = invoices.data ?? [];
  const countByStatus = Map.groupBy(rows, (row) => row.status);
  const visibleRows = rows.filter((row) => statuses.includes(row.status));
  const total = visibleRows.reduce((sum, row) => sum + row.totalIncludingFee, 0);

  return (
    <Stack>
      <Select
        label="Fakturarunde"
        placeholder={batches.isLoading ? "Laster …" : "Velg runde"}
        data={(batches.data ?? []).map((candidate) => ({
          value: candidate.prefix,
          label: batchLabel(candidate),
        }))}
        value={batch ?? null}
        onChange={selectBatch}
        searchable
        allowDeselect={false}
        w={{ base: "100%", sm: 340 }}
      />
      <Chip.Group
        multiple
        value={statuses}
        onChange={(next) => setStatuses(INVOICE_STATUSES.filter((status) => next.includes(status)))}
      >
        <Group gap="xs">
          {INVOICE_STATUSES.map((status) => (
            <Chip
              key={status}
              value={status}
              color={INVOICE_STATUS_COLORS[status]}
              variant="light"
              size="sm"
            >
              {INVOICE_STATUS_LABELS[status]} {countByStatus.get(status)?.length ?? 0}
            </Chip>
          ))}
        </Group>
      </Chip.Group>
      <InvoiceGrid
        rows={visibleRows}
        loading={batches.isLoading || invoices.isLoading}
        onOpen={openInvoice}
        onSelectionChange={setSelectedIds}
      />
      {invoices.data !== undefined && (
        <Text size="sm" c="dimmed">
          {visibleRows.length} av {rows.length} fakturaer, {formatKroner(total)} til sammen. Klikk
          på en faktura for å se detaljer, huk av for å eksportere.
        </Text>
      )}

      <Affix position={{ bottom: 16, left: 0, right: 0 }} zIndex={150}>
        <Transition transition="slide-up" mounted={selectedIds.length > 0}>
          {(style) => (
            <Group justify="center" style={style} px="md">
              <Paper shadow="lg" radius="xl" withBorder px="md" py="xs">
                <Group gap="sm" wrap="nowrap">
                  <Text fw={600} size="sm" style={{ whiteSpace: "nowrap" }}>
                    {selectedIds.length} valgt
                  </Text>
                  <Menu position="top" shadow="md" withinPortal>
                    <Menu.Target>
                      <Button
                        size="compact-md"
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
