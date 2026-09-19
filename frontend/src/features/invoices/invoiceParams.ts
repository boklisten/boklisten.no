import { stringParam } from "@/shared/utils/searchParams";

const INVOICE_TABS = ["oversikt", "elevfakturaer", "selskapsfaktura"] as const;
type InvoiceTab = (typeof INVOICE_TABS)[number];

interface InvoiceSearchParams {
  fakturaFane?: InvoiceTab;
  /** The five-digit batch prefixes the overview is narrowed to, comma-separated. Missing means all. */
  fakturarunde?: string;
  /** Document id of the invoice open in the detail drawer. */
  faktura?: string;
}

const BATCH_PREFIX_PATTERN = /^\d{5}$/;

export function parseInvoiceTab(value: unknown): InvoiceTab | undefined {
  return INVOICE_TABS.find((tab) => tab === value);
}

/** "20261,20252" → ["20261", "20252"], dropping anything that is not a batch prefix. */
export function parseBatchPrefixes(value: string | undefined): string[] {
  return [
    ...new Set((value ?? "").split(",").filter((prefix) => BATCH_PREFIX_PATTERN.test(prefix))),
  ];
}

export function joinBatchPrefixes(prefixes: string[]): string | undefined {
  return prefixes.length === 0 ? undefined : prefixes.join(",");
}

export function validateInvoiceSearch(search: Record<string, unknown>): InvoiceSearchParams {
  const invoice = stringParam(search["faktura"]);
  return {
    fakturaFane: parseInvoiceTab(search["fakturaFane"]),
    fakturarunde: joinBatchPrefixes(parseBatchPrefixes(stringParam(search["fakturarunde"]))),
    faktura: /^[\da-f]{24}$/i.test(invoice) ? invoice : undefined,
  };
}
