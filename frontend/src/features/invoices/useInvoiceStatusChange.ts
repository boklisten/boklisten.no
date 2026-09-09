import type { InvoiceListRow, InvoiceStatus } from "@boklisten/backend/shared/invoice";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { INVOICE_STATUS_LABELS } from "@/features/invoices/invoiceLabels";
import useApiClient from "@/shared/hooks/useApiClient";
import asyncConfirmModal from "@/shared/utils/asyncConfirmModal";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

const MAX_WARNING_LINES = 5;

/**
 * Marking an invoice paid records an order on the customer and buys out the books, and leaving
 * paid undoes that, so those two transitions ask first. Resolves to whether the change may go
 * ahead.
 */
export async function confirmPaymentChange({
  count,
  toPaid,
  zIndex,
}: {
  count: number;
  toPaid: boolean;
  zIndex?: number;
}): Promise<boolean> {
  const subject = count === 1 ? "fakturaen" : `${count} fakturaer`;
  const invoices = count === 1 ? "fakturaen" : "fakturaene";
  const customer = count === 1 ? "kundens" : "kundenes";
  return asyncConfirmModal({
    title: toPaid ? `Merk ${subject} som betalt?` : `Fjern betalingen på ${subject}?`,
    children: toPaid
      ? `Bøkene på ${invoices} blir registrert som kjøpt ut, og betalingen legges i ${customer} ordrehistorikk.`
      : `Bøkene blir ikke lenger registrert som kjøpt ut, og betalingen fjernes fra ${customer} ordrehistorikk.`,
    confirmLabel: toPaid ? "Merk som betalt" : "Fjern betalingen",
    zIndex,
  });
}

export function showStatusChangeResult(count: number, status: InvoiceStatus, warnings: string[]) {
  const subject = count === 1 ? "Fakturaen" : `${count} fakturaer`;
  const headline = `${subject} ble satt til ${INVOICE_STATUS_LABELS[status].toLowerCase()}`;
  if (warnings.length === 0) {
    showSuccessNotification(headline);
    return;
  }
  const shown = warnings.slice(0, MAX_WARNING_LINES);
  const rest = warnings.length - shown.length;
  showErrorNotification({
    title: headline,
    message: [...shown, ...(rest > 0 ? [`… og ${rest} til.`] : [])].join("\n"),
    color: "yellow",
    autoClose: false,
    style: { whiteSpace: "pre-line" },
  });
}

/**
 * Changes the status of one or many listed invoices from the overview. The rows are patched in
 * every cached list so the grid and the tiles update without a refetch.
 */
export default function useInvoiceStatusChange() {
  const { api, client } = useApiClient();
  const queryClient = useQueryClient();

  const patchRows = (invoiceIds: string[], status: InvoiceStatus) => {
    const changed = new Set(invoiceIds);
    queryClient.setQueriesData<InvoiceListRow[]>(
      { queryKey: api.invoices.list.pathKey() },
      (rows) => rows?.map((row) => (changed.has(row.id) ? { ...row, status } : row)),
    );
    void queryClient.invalidateQueries({ queryKey: api.invoices.get.pathKey() });
  };

  const mutation = useMutation({
    mutationFn: async ({ invoiceIds, status }: { invoiceIds: string[]; status: InvoiceStatus }) => {
      if (invoiceIds.length === 1) {
        const result = await client.api.invoices.setStatus({
          params: { invoiceId: invoiceIds[0] ?? "" },
          body: { status },
        });
        return result.warnings;
      }
      const result = await client.api.invoices.setStatuses({ body: { invoiceIds, status } });
      return result.warnings;
    },
    onSuccess: (warnings, { invoiceIds, status }) => {
      patchRows(invoiceIds, status);
      showStatusChangeResult(invoiceIds.length, status, warnings);
    },
    onError: (error) => showErrorNotification(errorMessage(error, "Klarte ikke endre statusen")),
  });

  const change = async (rows: InvoiceListRow[], status: InvoiceStatus) => {
    const targets = rows.filter((row) => row.status !== status);
    if (targets.length === 0) {
      return;
    }
    const paymentInvolved = status === "paid" || targets.some((row) => row.status === "paid");
    if (
      paymentInvolved &&
      !(await confirmPaymentChange({ count: targets.length, toPaid: status === "paid" }))
    ) {
      return;
    }
    mutation.mutate({ invoiceIds: targets.map((row) => row.id), status });
  };

  return { change, pending: mutation.isPending };
}
