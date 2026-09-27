import Invoice from "#models/invoice";
import type { GeneratableInvoiceType, InvoiceGenerationDefaults } from "#shared/invoice";

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
  const firstLine = invoice.lines[0];
  const feePercentage =
    invoice.type === "rent" && firstLine && firstLine.unit > 0
      ? Number((firstLine.gross / firstLine.unit).toFixed(2))
      : fallback.feePercentage;
  return {
    fee: invoice.feeUnit ?? fallback.fee,
    feeVatPercentage:
      invoice.feeNet !== null && invoice.feeVat !== null && invoice.feeNet > 0
        ? Number((invoice.feeVat / invoice.feeNet).toFixed(2))
        : fallback.feeVatPercentage,
    feePercentage,
    daysToDeadline: fallback.daysToDeadline,
    reference: invoice.reference,
  };
}

export async function generationDefaults(
  type: GeneratableInvoiceType,
): Promise<InvoiceGenerationDefaults> {
  const newest = await Invoice.query()
    .where("type", type)
    .whereNotNull("fee_unit")
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .first();
  const fallback = LEGACY_DEFAULTS[type];
  return newest ? settingsFrom(newest, fallback) : fallback;
}
