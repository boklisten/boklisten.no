import type { BookInvoiceSummary } from "@boklisten/backend/shared/book-details";
import { Badge } from "@mantine/core";

import { INVOICE_STATUS_COLORS } from "@/features/invoices/invoiceLabels";

const LABELS: Record<BookInvoiceSummary["status"], string> = {
  unpaid: "Fakturert",
  "debt-collection": "Sendt til inkasso",
  paid: "Faktura betalt",
  "loss-note": "Faktura tapsført",
};

/** Where the book's invoice stands, in the colour the invoice page gives the same status. */
export function InvoiceStatusBadge({ status }: { status: BookInvoiceSummary["status"] }) {
  return (
    <Badge size="sm" variant="light" color={INVOICE_STATUS_COLORS[status]} tt="none">
      {LABELS[status]}
    </Badge>
  );
}

/** That the book is on an invoice, on its row; nothing when it is not. */
export default function InvoiceBadge({ invoice }: { invoice: BookInvoiceSummary | null }) {
  return invoice && <InvoiceStatusBadge status={invoice.status} />;
}
