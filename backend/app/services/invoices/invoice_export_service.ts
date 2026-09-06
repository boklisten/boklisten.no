import moment from "moment-timezone";

import BadRequestException from "#exceptions/bad_request_exception";
import { toSemicolonCsv } from "#services/invoices/csv";
import { tripletexRows, vismaRows } from "#services/invoices/invoice_export_rows";
import type { TripletexLookups } from "#services/invoices/invoice_export_rows";
import { isNotNullish } from "#services/typescript_helpers";
import { StorageService } from "#services/storage_service";
import type { BlDocument } from "#shared/bl-document";
import type { Invoice, InvoiceExportFile, InvoiceExportFormat } from "#shared/invoice";

function byId<T extends BlDocument>(documents: T[]): Map<string, T> {
  return new Map(documents.map((document) => [document.id, document]));
}

/** The invoices in the order they were asked for, which is the order they appear in the file. */
async function invoicesInOrder(invoiceIds: string[]): Promise<Invoice[]> {
  const invoices = byId(await StorageService.Invoices.getMany(invoiceIds, "admin"));
  const missing = invoiceIds.filter((id) => !invoices.has(id));
  if (missing.length > 0) {
    throw new BadRequestException(`Fant ikke faktura ${missing.join(", ")}`);
  }
  return invoiceIds.map((id) => invoices.get(id)).filter(isNotNullish);
}

/** The branch name is printed on the invoice, but only the branch id is stored. */
async function withBranchNames(invoices: Invoice[]): Promise<Invoice[]> {
  const branchIds = [...new Set(invoices.map((invoice) => invoice.branch).filter(isNotNullish))];
  const branches = byId(await StorageService.Branches.getMany(branchIds, "admin"));
  return invoices.map((invoice) => {
    const branch = invoice.branch ? branches.get(invoice.branch) : undefined;
    return branch
      ? { ...invoice, customerInfo: { ...invoice.customerInfo, branchName: branch.name } }
      : invoice;
  });
}

async function tripletexLookups(invoices: Invoice[]): Promise<TripletexLookups> {
  const customerItemIds = invoices.flatMap((invoice) =>
    invoice.customerItemPayments.map((payment) => payment.customerItem).filter(isNotNullish),
  );
  if (customerItemIds.length < invoices.flatMap((invoice) => invoice.customerItemPayments).length) {
    throw new BadRequestException(
      "Tripletex-format kan bare lages for elevfakturaer, ikke for selskapsfakturaer.",
    );
  }
  const customerItems = await StorageService.CustomerItems.getMany(customerItemIds, "admin");
  const itemIds = [...new Set(customerItems.map((customerItem) => customerItem.item))];
  const branchIds = [
    ...new Set(
      customerItems
        .map((customerItem) => customerItem.handoutInfo?.handoutById)
        .filter(isNotNullish),
    ),
  ];
  const [items, branches] = await Promise.all([
    StorageService.Items.getMany(itemIds, "admin"),
    StorageService.Branches.getMany(branchIds, "admin"),
  ]);
  return { customerItems: byId(customerItems), items: byId(items), branches: byId(branches) };
}

/** bl-admin named the files after the year and the hour of the export, e.g. 202614_visma_invoice.csv. */
function filename(system: "visma" | "tripletex"): string {
  const now = moment.tz("Europe/Oslo");
  return `${now.year()}${now.hour()}_${system}_invoice.csv`;
}

export async function exportInvoices(
  invoiceIds: string[],
  format: InvoiceExportFormat,
): Promise<InvoiceExportFile> {
  const invoices = await withBranchNames(await invoicesInOrder(invoiceIds));
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
