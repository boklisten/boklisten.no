import { stringParam } from "@/shared/utils/searchParams";

export const INVOICE_TABS = ["oversikt", "elevfakturaer", "selskapsfaktura"] as const;
export type InvoiceTab = (typeof INVOICE_TABS)[number];

export interface InvoiceSearchParams {
  fakturaFane?: InvoiceTab;
  /** The five-digit batch prefix shown in the overview. */
  fakturarunde?: string;
  /** Document id of the invoice open in the detail drawer. */
  faktura?: string;
}

export function parseInvoiceTab(value: unknown): InvoiceTab | undefined {
  return INVOICE_TABS.find((tab) => tab === value);
}

export function validateInvoiceSearch(search: Record<string, unknown>): InvoiceSearchParams {
  const batch = stringParam(search["fakturarunde"]);
  const invoice = stringParam(search["faktura"]);
  return {
    fakturaFane: parseInvoiceTab(search["fakturaFane"]),
    fakturarunde: /^\d{5}$/.test(batch) ? batch : undefined,
    faktura: /^[\da-f]{24}$/i.test(invoice) ? invoice : undefined,
  };
}
