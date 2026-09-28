import db from "@adonisjs/lucid/services/db";

import Branch from "#models/branch";
import Invoice from "#models/invoice";
import type {
  Invoice as InvoiceDto,
  InvoiceListRow,
  InvoiceStatus,
  InvoiceType,
} from "#shared/invoice";

interface ListRow {
  id: string;
  invoice_number: string;
  customer_name: string | null;
  customer_id: string | null;
  customer_organization_number: string | null;
  type: InvoiceType | null;
  created_at: Date;
  due_date: string;
  total_including_fee: number;
  status: InvoiceStatus;
}

/** Every invoice, oldest number first. The overview filters and searches client-side. */
export async function listInvoices(): Promise<InvoiceListRow[]> {
  const rows: ListRow[] = await db
    .from("invoices")
    .select(
      "id",
      "invoice_number",
      "customer_name",
      "customer_id",
      "customer_organization_number",
      "type",
      "created_at",
      "due_date",
      "total_including_fee",
      "status",
    )
    .orderBy("invoice_number")
    .orderBy("id");
  return rows.map((row) => ({
    id: row.id,
    invoiceNumber: row.invoice_number,
    customerName: row.customer_name,
    customerId: row.customer_id,
    customerOrganizationNumber: row.customer_organization_number,
    type: row.type,
    createdAt: row.created_at,
    dueDate: row.due_date,
    totalIncludingFee: row.total_including_fee,
    status: row.status,
  }));
}

/** The invoice as the API shows it, with its branch's current name. */
export async function invoiceDto(invoice: Invoice): Promise<InvoiceDto> {
  const branch = await Branch.findOptional(invoice.branchId);
  return invoice.toDto(branch?.name ?? null);
}

export async function getInvoice(invoiceId: string): Promise<InvoiceDto> {
  return invoiceDto(await Invoice.getOrFail(invoiceId));
}
