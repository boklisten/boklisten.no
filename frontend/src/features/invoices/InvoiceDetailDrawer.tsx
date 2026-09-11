import type { Invoice, InvoiceStatus } from "@boklisten/backend/shared/invoice";
import { invoiceStatus } from "@boklisten/backend/shared/invoice";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showCustomer } from "@/features/kasse/kasseParams";
import InvoiceStatusControl from "@/features/invoices/InvoiceStatusControl";
import { INVOICE_TYPE_LABELS, formatDate, formatKroner } from "@/features/invoices/invoiceLabels";
import { confirmPaymentChange } from "@/features/invoices/useInvoiceStatusChange";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import EntityLink from "@/shared/components/EntityLink";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";
import type { ReactNode } from "react";
import { useState } from "react";

/** The write endpoints return the stored document, which has the branch id but not its name. */
function withBranchName(updated: Invoice, current: Invoice | undefined): Invoice {
  return current?.customerInfo.branchName
    ? {
        ...updated,
        customerInfo: { ...updated.customerInfo, branchName: current.customerInfo.branchName },
      }
    : updated;
}

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
  onLineCancel: (lineIndex: number, cancel: boolean) => void;
  busy: boolean;
  compact: boolean;
  warnings: string[];
}) {
  const { customerInfo, payment } = invoice;
  const isCompany = Boolean(customerInfo.organizationNumber);
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
            {invoice.invoiceId}
          </Title>
        </Stack>
        <InvoiceStatusControl
          value={invoiceStatus(invoice)}
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
        <Fact label="Opprettet">{formatDate(invoice.creationTime)}</Fact>
        <Fact label="Forfall">{formatDate(invoice.duedate)}</Fact>
        {invoice.reference && <Fact label="Referanse">{invoice.reference}</Fact>}
        {invoice.ourReference && <Fact label="Vår referanse">{invoice.ourReference}</Fact>}
      </Stack>

      <Divider label="Kunde" labelPosition="left" />
      <Stack gap={4}>
        <Text fw={600}>
          {customerInfo.userDetail ? (
            <EntityLink to="/admin/kasse" search={showCustomer(customerInfo.userDetail)}>
              {customerInfo.name}
            </EntityLink>
          ) : (
            customerInfo.name
          )}
        </Text>
        {customerInfo.branchName && <Text size="sm">{customerInfo.branchName}</Text>}
        <Text size="sm">
          {customerInfo.postal.address}, {customerInfo.postal.code} {customerInfo.postal.city}
        </Text>
        <Text size="sm">
          {customerInfo.phone}
          {customerInfo.email && ` · ${customerInfo.email}`}
        </Text>
        {customerInfo.dob && <Fact label="Fødselsdato">{formatDate(customerInfo.dob)}</Fact>}
        {customerInfo.organizationNumber && (
          <Fact label="Organisasjonsnummer">{customerInfo.organizationNumber}</Fact>
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
          {invoice.customerItemPayments.map((line, index) => (
            <Table.Tr
              key={`${line.title}-${index}`}
              c={line.cancel ? "dimmed" : undefined}
              td={line.cancel ? "line-through" : undefined}
            >
              <Table.Td>{line.title}</Table.Td>
              <Table.Td ta="right" style={amountStyle}>
                {line.numberOfItems}
              </Table.Td>
              <Table.Td ta="right" style={amountStyle}>
                {formatKroner(line.payment.unit)}
              </Table.Td>
              <Table.Td ta="right" style={amountStyle}>
                {line.payment.discount ? `${line.payment.discount} %` : ""}
              </Table.Td>
              <Table.Td ta="right" style={amountStyle}>
                {formatKroner(line.payment.gross)}
              </Table.Td>
              <Table.Td>
                <Tooltip label={line.cancel ? "Ta med linjen igjen" : "Stryk linjen"}>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={line.cancel ? `Ta med ${line.title} igjen` : `Stryk ${line.title}`}
                    disabled={busy}
                    onClick={() => onLineCancel(index, !line.cancel)}
                  >
                    {line.cancel ? <IconArrowBackUp size={16} /> : <IconBan size={16} />}
                  </ActionIcon>
                </Tooltip>
              </Table.Td>
            </Table.Tr>
          ))}
          {payment.fee && (
            <Table.Tr c="dimmed">
              <Table.Td>Administrasjonsgebyr</Table.Td>
              <Table.Td ta="right" style={amountStyle}>
                {invoice.customerItemPayments.length}
              </Table.Td>
              <Table.Td ta="right" style={amountStyle}>
                {formatKroner(payment.fee.unit)}
              </Table.Td>
              <Table.Td />
              <Table.Td ta="right" style={amountStyle}>
                {formatKroner(payment.fee.gross)}
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
                  herav mva {formatKroner(payment.total.vat)}
                </Text>
              </Group>
            </Table.Th>
            <Table.Th ta="right" style={amountStyle}>
              {formatKroner(payment.totalIncludingFee)}
            </Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Tfoot>
      </Table>

      {invoice.comments && invoice.comments.length > 0 && (
        <>
          <Divider label="Kommentarer" labelPosition="left" />
          <Stack gap={4}>
            {invoice.comments.map((comment, index) => (
              <Text key={`${comment.msg}-${index}`} size="sm">
                {comment.msg}
              </Text>
            ))}
          </Stack>
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
  const { api, client } = useApiClient();
  const queryClient = useQueryClient();
  const narrow = useMediaQuery("(max-width: 48em)");
  const [warnings, setWarnings] = useState<string[]>([]);

  const detailQuery = api.invoices.get.queryOptions({ params: { invoiceId: invoiceId ?? "" } });
  const invoice = useQuery({ ...detailQuery, enabled: invoiceId !== undefined });

  const refreshList = () =>
    queryClient.invalidateQueries({ queryKey: api.invoices.list.pathKey() });

  const changeStatus = useMutation({
    mutationFn: (status: InvoiceStatus) =>
      client.api.invoices.setStatus({ params: { invoiceId: invoiceId ?? "" }, body: { status } }),
    onSuccess: (result) => {
      queryClient.setQueryData(detailQuery.queryKey, (current) =>
        withBranchName(result.invoice, current),
      );
      setWarnings(result.warnings);
      if (result.warnings.length === 0) {
        showSuccessNotification("Statusen ble endret");
      }
      void refreshList();
    },
    onError: (error) => showErrorNotification(errorMessage(error, "Klarte ikke endre statusen")),
  });

  const cancelLine = useMutation({
    mutationFn: ({ lineIndex, cancel }: { lineIndex: number; cancel: boolean }) =>
      client.api.invoices.setLineCancelled({
        params: { invoiceId: invoiceId ?? "", lineIndex: String(lineIndex) },
        body: { cancel },
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(detailQuery.queryKey, (current) => withBranchName(updated, current));
    },
    onError: (error) => showErrorNotification(errorMessage(error, "Klarte ikke endre linjen")),
  });

  async function onStatusChange(status: InvoiceStatus) {
    if (!invoice.data) {
      return;
    }
    const wasPaid = invoiceStatus(invoice.data) === "paid";
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
        <InvoiceDocument
          invoice={invoice.data}
          onStatusChange={(status) => void onStatusChange(status)}
          onLineCancel={(lineIndex, cancel) => cancelLine.mutate({ lineIndex, cancel })}
          busy={changeStatus.isPending || cancelLine.isPending}
          compact={narrow ?? false}
          warnings={warnings}
        />
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
