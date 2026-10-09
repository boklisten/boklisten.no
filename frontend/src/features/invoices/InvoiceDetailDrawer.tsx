import type { Invoice, InvoiceStatus } from "@boklisten/backend/shared/invoice";
import {
  ActionIcon,
  Box,
  Divider,
  Drawer,
  Group,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconArrowBackUp, IconBan } from "@tabler/icons-react";
import { hashKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showCustomer } from "@/features/kasse/kasseParams";
import InvoiceDeleteSection from "@/features/invoices/InvoiceDeleteSection";
import InvoiceStatusControl from "@/features/invoices/InvoiceStatusControl";
import { INVOICE_TYPE_LABELS, formatDate, formatKroner } from "@/features/invoices/invoiceLabels";
import { confirmPaymentChange } from "@/features/invoices/useInvoiceStatusChange";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import EntityLink from "@/shared/components/EntityLink";
import PostalCity from "@/shared/components/PostalCity";
import { api, apiClient } from "@/shared/utils/apiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";
import type { ReactNode } from "react";
import { useState } from "react";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Group justify="space-between" gap="md" wrap="nowrap" align="baseline">
      <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Text size="sm" ta="right">
        {children}
      </Text>
    </Group>
  );
}

const amountStyle = { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } as const;

function InvoiceDocument({
  invoice,
  onStatusChange,
  onLineCancel,
  busy,
  compact,
  warnings,
}: {
  invoice: Invoice;
  onStatusChange: (status: InvoiceStatus) => void;
  onLineCancel: (position: number, cancelled: boolean) => void;
  busy: boolean;
  compact: boolean;
  warnings: string[];
}) {
  const isCompany = Boolean(invoice.customerOrganizationNumber);
  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
        <Stack gap={2}>
          <Text size="sm" c="dimmed">
            {isCompany
              ? "Selskapsfaktura"
              : invoice.type
                ? INVOICE_TYPE_LABELS[invoice.type]
                : "Faktura"}
          </Text>
          <Title order={2} style={amountStyle}>
            {invoice.invoiceNumber}
          </Title>
        </Stack>
        <InvoiceStatusControl
          value={invoice.status}
          onChange={onStatusChange}
          disabled={busy}
          compact={compact}
          size="sm"
          dropdownZIndex={1100}
        />
      </Group>
      {warnings.map((warning) => (
        <WarningAlert key={warning}>{warning}</WarningAlert>
      ))}

      <Stack gap={4}>
        <Fact label="Opprettet">{formatDate(invoice.createdAt)}</Fact>
        <Fact label="Forfall">{formatDate(invoice.dueDate)}</Fact>
        {invoice.reference && <Fact label="Referanse">{invoice.reference}</Fact>}
        {invoice.ourReference && <Fact label="Vår referanse">{invoice.ourReference}</Fact>}
      </Stack>

      <Divider label="Kunde" labelPosition="left" />
      <Stack gap={4}>
        <Text fw={600}>
          {invoice.customerId ? (
            <EntityLink to="/admin/kasse" search={showCustomer(invoice.customerId)}>
              {invoice.customerName}
            </EntityLink>
          ) : (
            invoice.customerName
          )}
        </Text>
        {invoice.branchName && <Text size="sm">{invoice.branchName}</Text>}
        <Text size="sm">
          {invoice.customerAddress}, {invoice.customerPostCode}{" "}
          <PostalCity postalCode={invoice.customerPostCode} />
        </Text>
        <Text size="sm">
          {invoice.customerPhone}
          {invoice.customerEmail && ` · ${invoice.customerEmail}`}
        </Text>
        {invoice.customerDob && <Fact label="Fødselsdato">{formatDate(invoice.customerDob)}</Fact>}
        {invoice.customerOrganizationNumber && (
          <Fact label="Organisasjonsnummer">{invoice.customerOrganizationNumber}</Fact>
        )}
      </Stack>

      <Divider label="Linjer" labelPosition="left" />
      <Table verticalSpacing="xs" withRowBorders={false}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Tittel</Table.Th>
            <Table.Th ta="right">Antall</Table.Th>
            <Table.Th ta="right">Pris</Table.Th>
            <Table.Th ta="right">Rabatt</Table.Th>
            <Table.Th ta="right">Beløp</Table.Th>
            <Table.Th w={40} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {invoice.lines.map((line, position) => (
            <Table.Tr
              key={position}
              c={line.cancelled ? "dimmed" : undefined}
              td={line.cancelled ? "line-through" : undefined}
            >
              <Table.Td>{line.title}</Table.Td>
              <Table.Td ta="right" style={amountStyle}>
                {line.numberOfItems}
              </Table.Td>
              <Table.Td ta="right" style={amountStyle}>
                {formatKroner(line.unit)}
              </Table.Td>
              <Table.Td ta="right" style={amountStyle}>
                {line.discount ? `${line.discount} %` : ""}
              </Table.Td>
              <Table.Td ta="right" style={amountStyle}>
                {formatKroner(line.gross)}
              </Table.Td>
              <Table.Td>
                <Tooltip label={line.cancelled ? "Ta med linjen igjen" : "Stryk linjen"}>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={
                      line.cancelled ? `Ta med ${line.title} igjen` : `Stryk ${line.title}`
                    }
                    disabled={busy}
                    onClick={() => onLineCancel(position, !line.cancelled)}
                  >
                    {line.cancelled ? <IconArrowBackUp size={16} /> : <IconBan size={16} />}
                  </ActionIcon>
                </Tooltip>
              </Table.Td>
            </Table.Tr>
          ))}
          {invoice.feeUnit !== null && invoice.feeGross !== null && (
            <Table.Tr c="dimmed">
              <Table.Td>Administrasjonsgebyr</Table.Td>
              <Table.Td ta="right" style={amountStyle}>
                {invoice.lines.length}
              </Table.Td>
              <Table.Td ta="right" style={amountStyle}>
                {formatKroner(invoice.feeUnit)}
              </Table.Td>
              <Table.Td />
              <Table.Td ta="right" style={amountStyle}>
                {formatKroner(invoice.feeGross)}
              </Table.Td>
              <Table.Td />
            </Table.Tr>
          )}
        </Table.Tbody>
        <Table.Tfoot>
          <Table.Tr>
            <Table.Th colSpan={4}>
              <Group justify="space-between">
                <span>Å betale</span>
                <Text span size="xs" c="dimmed" fw={400}>
                  herav mva {formatKroner(invoice.totalVat)}
                </Text>
              </Group>
            </Table.Th>
            <Table.Th ta="right" style={amountStyle}>
              {formatKroner(invoice.totalIncludingFee)}
            </Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Tfoot>
      </Table>

      {invoice.comment && (
        <>
          <Divider label="Kommentar" labelPosition="left" />
          <Text size="sm">{invoice.comment}</Text>
        </>
      )}
    </Stack>
  );
}

/**
 * The invoice as a document: number and status on top, the customer, then the lines with the
 * total. Opened from the list, so the list stays where it was when the drawer closes.
 */
export default function InvoiceDetailDrawer({
  invoiceId,
  onClose,
}: {
  invoiceId: string | undefined;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const narrow = useMediaQuery("(max-width: 48em)");
  const [warnings, setWarnings] = useState<string[]>([]);

  const detailQuery = api.invoices.show.queryOptions({ params: { invoiceId: invoiceId ?? "" } });
  const invoice = useQuery({ ...detailQuery, enabled: invoiceId !== undefined });

  const changeStatus = useMutation({
    mutationFn: (status: InvoiceStatus) =>
      apiClient.api.invoices.setStatus({
        params: { invoiceId: invoiceId ?? "" },
        body: { status },
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(detailQuery.queryKey, result.invoice);
      setWarnings(result.warnings);
      if (result.warnings.length === 0) {
        showSuccessNotification("Statusen ble endret");
      }
      // A payment also touches the customer's orders and books, so every cache is refreshed.
      void queryClient.invalidateQueries();
    },
    onError: (error) => showErrorNotification(errorMessage(error, "Klarte ikke endre statusen")),
  });

  const cancelLine = useMutation({
    mutationFn: ({ position, cancelled }: { position: number; cancelled: boolean }) =>
      apiClient.api.invoices.setLineCancelled({
        params: { invoiceId: invoiceId ?? "", lineIndex: String(position) },
        body: { cancelled },
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(detailQuery.queryKey, updated);
    },
    onError: (error) => showErrorNotification(errorMessage(error, "Klarte ikke endre linjen")),
  });

  /**
   * Every list that counted the invoice is refreshed. Its own query is left alone: the drawer is
   * still mounted with the old id for a moment, and refetching it would only produce a 404.
   */
  function onDeleted() {
    setWarnings([]);
    onClose();
    void queryClient.invalidateQueries({
      predicate: (query) => query.queryHash !== hashKey(detailQuery.queryKey),
    });
  }

  async function onStatusChange(status: InvoiceStatus) {
    if (!invoice.data) {
      return;
    }
    const wasPaid = invoice.data.status === "paid";
    if (
      (status === "paid" || wasPaid) &&
      !(await confirmPaymentChange({ count: 1, toPaid: status === "paid", zIndex: 1200 }))
    ) {
      return;
    }
    changeStatus.mutate(status);
  }

  return (
    <Drawer
      opened={invoiceId !== undefined}
      onClose={() => {
        setWarnings([]);
        onClose();
      }}
      position="right"
      size={narrow ? "100%" : "lg"}
      zIndex={1000}
      title={
        <Text fw={600} c="dimmed" size="sm">
          Faktura
        </Text>
      }
    >
      {invoice.error ? (
        <ErrorAlert title="Klarte ikke laste inn fakturaen">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
      ) : invoice.data ? (
        <Stack gap="xl">
          <InvoiceDocument
            invoice={invoice.data}
            onStatusChange={(status) => void onStatusChange(status)}
            onLineCancel={(position, cancelled) => cancelLine.mutate({ position, cancelled })}
            busy={changeStatus.isPending || cancelLine.isPending}
            compact={narrow ?? false}
            warnings={warnings}
          />
          {invoice.data.status === "unpaid" && (
            <InvoiceDeleteSection invoice={invoice.data} onDeleted={onDeleted} />
          )}
        </Stack>
      ) : (
        <Box>
          <Skeleton height={36} width="50%" mb="md" />
          <Skeleton height={80} mb="md" />
          <Skeleton height={160} />
        </Box>
      )}
    </Drawer>
  );
}
