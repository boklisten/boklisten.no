import type { MantineColor } from "@mantine/core";
import type {
  InvoiceBatch,
  InvoiceExportFormat,
  InvoiceStatus,
  InvoiceType,
} from "@boklisten/backend/shared/invoice";
import { INVOICE_STATUSES } from "@boklisten/backend/shared/invoice";
import dayjs from "dayjs";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  unpaid: "Ubetalt",
  paid: "Betalt",
  creditNote: "Kreditnota",
  debtCollection: "Inkasso",
  lossNote: "Tapsført",
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, MantineColor> = {
  unpaid: "orange",
  paid: "green",
  creditNote: "gray",
  debtCollection: "red",
  lossNote: "violet",
};

export const INVOICE_STATUS_OPTIONS = INVOICE_STATUSES.map((status) => ({
  value: status,
  label: INVOICE_STATUS_LABELS[status],
}));

export function parseInvoiceStatus(value: unknown): InvoiceStatus | undefined {
  return INVOICE_STATUSES.find((status) => status === value);
}

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  "partly-payment": "Delbetaling",
  rent: "Lån",
  loan: "Lån",
};

export function invoiceKindLabel(batch: Pick<InvoiceBatch, "type" | "company">): string {
  if (batch.company) {
    return "Selskap";
  }
  return batch.type === null ? "Elev" : INVOICE_TYPE_LABELS[batch.type];
}

function batchSeason(firstCreated: Date | null): string {
  if (firstCreated === null) {
    return "";
  }
  const created = dayjs(firstCreated);
  return `${created.month() < 6 ? "vår" : "høst"} ${created.year()}`;
}

/** "20261 · Delbetaling høst 2026 · 295 fakturaer" */
export function batchLabel(batch: InvoiceBatch): string {
  const count = batch.count === 1 ? "1 faktura" : `${batch.count} fakturaer`;
  return `${batch.prefix} · ${invoiceKindLabel(batch)} ${batchSeason(batch.firstCreated)} · ${count}`;
}

export const EXPORT_FORMAT_LABELS: Record<InvoiceExportFormat, string> = {
  visma: "Visma",
  "visma-credit": "Visma kreditnota",
  "visma-ehf": "Visma EHF",
  tripletex: "Tripletex",
};

const kroner = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatKroner(amount: number): string {
  return kroner.format(amount);
}

export function formatDate(date: Date | string | null | undefined): string {
  return date ? dayjs(date).format("DD.MM.YYYY") : "";
}
