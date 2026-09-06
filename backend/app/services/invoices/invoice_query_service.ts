import BadRequestException from "#exceptions/bad_request_exception";
import { StorageService } from "#services/storage_service";
import { invoiceStatus } from "#shared/invoice";
import type { Invoice, InvoiceBatch, InvoiceListRow, InvoiceType } from "#shared/invoice";

/** The first five digits of an invoice number: the year and the batch digit. */
const INVOICE_BATCH_PREFIX_LENGTH = 5;
const BATCH_PREFIX_PATTERN = /^\d{5}$/;

interface BatchRow {
  id: string;
  count: number;
  types: (InvoiceType | null)[];
  organizationNumbers: number;
  firstCreated: Date | null;
}

export async function listInvoiceBatches(): Promise<InvoiceBatch[]> {
  const rows = await StorageService.Invoices.aggregate<BatchRow>([
    { $match: { invoiceId: { $type: "string" } } },
    {
      $group: {
        _id: { $substrCP: ["$invoiceId", 0, INVOICE_BATCH_PREFIX_LENGTH] },
        count: { $sum: 1 },
        types: { $addToSet: { $ifNull: ["$type", null] } },
        organizationNumbers: {
          $sum: { $cond: [{ $gt: ["$customerInfo.organizationNumber", null] }, 1, 0] },
        },
        firstCreated: { $min: "$creationTime" },
      },
    },
    { $sort: { _id: -1 } },
  ]);
  return rows.map((row) => ({
    prefix: row.id,
    count: row.count,
    type: row.types.find((type) => type !== null) ?? null,
    company: row.organizationNumbers > 0,
    firstCreated: row.firstCreated,
  }));
}

interface ListRow extends Omit<InvoiceListRow, "status"> {
  customerHavePayed: boolean;
  toCreditNote: boolean;
  toDebtCollection: boolean;
  toLossNote: boolean;
}

/**
 * The invoices whose number starts with the batch prefix. bl-admin matched the prefix anywhere
 * in the number, so batch 20201 also listed invoice 20202010; anchoring the match fixes that.
 */
export async function listInvoicesInBatch(prefix: string): Promise<InvoiceListRow[]> {
  if (!BATCH_PREFIX_PATTERN.test(prefix)) {
    throw new BadRequestException("Fakturarunden må være fem sifre.");
  }
  const rows = await StorageService.Invoices.aggregate<ListRow>([
    { $match: { invoiceId: { $regex: `^${prefix}` } } },
    {
      $project: {
        _id: 0,
        id: { $toString: "$_id" },
        invoiceId: 1,
        customerName: { $ifNull: ["$customerInfo.name", ""] },
        organizationNumber: { $ifNull: ["$customerInfo.organizationNumber", null] },
        type: { $ifNull: ["$type", null] },
        duedate: 1,
        totalIncludingFee: { $ifNull: ["$payment.totalIncludingFee", 0] },
        customerHavePayed: { $ifNull: ["$customerHavePayed", false] },
        toCreditNote: { $ifNull: ["$toCreditNote", false] },
        toDebtCollection: { $ifNull: ["$toDebtCollection", false] },
        toLossNote: { $ifNull: ["$toLossNote", false] },
      },
    },
    { $sort: { invoiceId: 1 } },
  ]);
  return rows.map((row) => {
    const { customerHavePayed, toCreditNote, toDebtCollection, toLossNote, ...listRow } = row;
    return Object.assign(listRow, {
      status: invoiceStatus({ customerHavePayed, toCreditNote, toDebtCollection, toLossNote }),
    });
  });
}

export async function getInvoice(invoiceId: string): Promise<Invoice> {
  const invoice = await StorageService.Invoices.get(invoiceId);
  if (!invoice.branch) {
    return invoice;
  }
  const branch = await StorageService.Branches.getOrNull(invoice.branch);
  return branch
    ? { ...invoice, customerInfo: { ...invoice.customerInfo, branchName: branch.name } }
    : invoice;
}
