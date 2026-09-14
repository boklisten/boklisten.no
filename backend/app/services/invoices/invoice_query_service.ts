import { StorageService } from "#services/storage_service";
import { invoiceStatus } from "#shared/invoice";
import type { Invoice, InvoiceListRow } from "#shared/invoice";

interface ListRow extends Omit<InvoiceListRow, "status"> {
  customerHavePayed: boolean;
  toCreditNote: boolean;
  toDebtCollection: boolean;
  toLossNote: boolean;
}

/** Every numbered invoice, oldest number first. The overview filters and searches client-side. */
export async function listInvoices(): Promise<InvoiceListRow[]> {
  const rows = await StorageService.Invoices.aggregate<ListRow>([
    { $match: { invoiceId: { $type: "string" } } },
    {
      $project: {
        _id: 0,
        id: { $toString: "$_id" },
        invoiceId: 1,
        customerName: { $ifNull: ["$customerInfo.name", ""] },
        organizationNumber: { $ifNull: ["$customerInfo.organizationNumber", null] },
        type: { $ifNull: ["$type", null] },
        created: { $ifNull: ["$creationTime", null] },
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
