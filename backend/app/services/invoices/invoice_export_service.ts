import { DateTime } from "luxon";

import Branch from "#models/branch";
import CustomerItem from "#models/customer_item";
import Invoice from "#models/invoice";
import Item from "#models/item";
import BadRequestException from "#exceptions/bad_request_exception";
import { toSemicolonCsv } from "#services/invoices/csv";
import { tripletexRows, vismaRows } from "#services/invoices/invoice_export_rows";
import type { TripletexLookups } from "#services/invoices/invoice_export_rows";
import { isNotNullish } from "#services/typescript_helpers";
import type {
  Invoice as InvoiceDto,
  InvoiceExportFile,
  InvoiceExportFormat,
} from "#shared/invoice";

function byId<T extends { id: string }>(documents: T[]): Map<string, T> {
  return new Map(documents.map((document) => [document.id, document]));
}

/**
 * The invoices, with the branch name printed on them, in the order they were asked for, which is
 * the order they appear in the file.
 */
async function invoicesInOrder(invoiceIds: string[]): Promise<InvoiceDto[]> {
  const invoices = byId(
    await Invoice.toDtos(await Invoice.query().whereIn("id", [...new Set(invoiceIds)])),
  );
  const missing = invoiceIds.filter((id) => !invoices.has(id));
  if (missing.length > 0) {
    throw new BadRequestException(`Fant ikke faktura ${missing.join(", ")}`);
  }
  return invoiceIds.map((id) => invoices.get(id)).filter(isNotNullish);
}

async function tripletexLookups(invoices: InvoiceDto[]): Promise<TripletexLookups> {
  const lines = invoices.flatMap((invoice) => invoice.lines);
  const customerItemIds = lines.map((line) => line.customerItemId).filter(isNotNullish);
  if (customerItemIds.length < lines.length) {
    throw new BadRequestException(
      "Tripletex-format kan bare lages for elevfakturaer, ikke for selskapsfakturaer.",
    );
  }
  const customerItems = await CustomerItem.findByIds(customerItemIds);
  const itemIds = [...new Set(customerItems.map((customerItem) => customerItem.itemId))];
  const branchIds = [...new Set(customerItems.map((customerItem) => customerItem.handoutBranchId))];
  const [items, branches, lastPeriodLines] = await Promise.all([
    Item.findMany(itemIds),
    Branch.findMany(branchIds),
    CustomerItem.lastPeriodLinesOf(customerItemIds),
  ]);
  return {
    customerItems: byId(customerItems.map((customerItem) => customerItem.toDto())),
    lastOrderIds: new Map(
      [...lastPeriodLines].map(([customerItemId, line]) => [customerItemId, line.orderId]),
    ),
    items: byId(items),
    branches: byId(branches),
  };
}

/** Legacy bl-admin named the files after the year and the hour of the export, e.g. 202614_visma_invoice.csv. */
function filename(system: "visma" | "tripletex"): string {
  const now = DateTime.now();
  return `${now.year}${now.hour}_${system}_invoice.csv`;
}

export async function exportInvoices(
  invoiceIds: string[],
  format: InvoiceExportFormat,
): Promise<InvoiceExportFile> {
  const invoices = await invoicesInOrder(invoiceIds);
  if (format === "tripletex") {
    const rows = tripletexRows(invoices, await tripletexLookups(invoices));
    return { filename: filename("tripletex"), csv: toSemicolonCsv(rows) };
  }
  const rows = vismaRows(invoices, {
    ehf: format === "visma-ehf",
    creditOfInvoice: format === "visma-credit",
  });
  return { filename: filename("visma"), csv: toSemicolonCsv(rows) };
}
