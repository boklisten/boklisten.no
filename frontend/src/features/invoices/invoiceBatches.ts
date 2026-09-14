import type { InvoiceListRow, InvoiceType } from "@boklisten/backend/shared/invoice";
import { invoiceBatchPrefix } from "@boklisten/backend/shared/invoice";

/** A generation run, or a year's company invoices: the invoices sharing a five-digit prefix. */
export interface InvoiceBatch {
  prefix: string;
  count: number;
  type: InvoiceType | null;
  company: boolean;
  firstCreated: Date | null;
}

/** Groups the rows by their number prefix, newest round first. */
export function invoiceBatches(rows: InvoiceListRow[]): InvoiceBatch[] {
  const batches = new Map<string, InvoiceBatch>();
  for (const row of rows) {
    const prefix = invoiceBatchPrefix(row.invoiceId);
    const batch = batches.get(prefix) ?? {
      prefix,
      count: 0,
      type: null,
      company: false,
      firstCreated: null,
    };
    batch.count += 1;
    batch.type ??= row.type;
    batch.company ||= row.organizationNumber !== null;
    if (row.created && (batch.firstCreated === null || row.created < batch.firstCreated)) {
      batch.firstCreated = row.created;
    }
    batches.set(prefix, batch);
  }
  return [...batches.values()].toSorted((a, b) => b.prefix.localeCompare(a.prefix));
}
