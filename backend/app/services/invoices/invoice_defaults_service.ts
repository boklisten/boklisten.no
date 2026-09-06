import { StorageService } from "#services/storage_service";
import type { GeneratableInvoiceType, Invoice, InvoiceGenerationDefaults } from "#shared/invoice";

const LEGACY_DEFAULTS: Record<GeneratableInvoiceType, InvoiceGenerationDefaults> = {
  "partly-payment": {
    fee: 120,
    feeVatPercentage: 0.25,
    feePercentage: 0.33,
    daysToDeadline: 14,
    reference: "Manglende delbetaling av skolebøker",
  },
  rent: {
    fee: 72,
    feeVatPercentage: 0.25,
    feePercentage: 1.1,
    daysToDeadline: 14,
    reference: "Manglende levering av skolebøker",
  },
};

/** Reads the settings back out of an invoice, so the newest batch can seed the next one. */
function settingsFrom(
  invoice: Invoice,
  fallback: InvoiceGenerationDefaults,
): InvoiceGenerationDefaults {
  const fee = invoice.payment.fee;
  const firstLine = invoice.customerItemPayments[0];
  const feePercentage =
    invoice.type === "rent" && firstLine && firstLine.payment.unit > 0
      ? Number((firstLine.payment.gross / firstLine.payment.unit).toFixed(2))
      : fallback.feePercentage;
  return {
    fee: fee?.unit ?? fallback.fee,
    feeVatPercentage:
      fee && fee.net > 0 ? Number((fee.vat / fee.net).toFixed(2)) : fallback.feeVatPercentage,
    feePercentage,
    daysToDeadline: fallback.daysToDeadline,
    reference: invoice.reference ?? fallback.reference,
  };
}

export async function generationDefaults(
  type: GeneratableInvoiceType,
): Promise<InvoiceGenerationDefaults> {
  const [newest] = await StorageService.Invoices.aggregate<Invoice>([
    { $match: { type, "payment.fee": { $ne: null } } },
    { $sort: { creationTime: -1 } },
    { $limit: 1 },
  ]);
  const fallback = LEGACY_DEFAULTS[type];
  return newest ? settingsFrom(newest, fallback) : fallback;
}
