import db from "@adonisjs/lucid/services/db";

import Branch from "#models/branch";
import Invoice from "#models/invoice";
import { invoiceStatus } from "#shared/invoice";
import type { Invoice as InvoiceDto, InvoiceListRow, InvoiceType } from "#shared/invoice";

interface ListRow {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_id: string | null;
  customer_organization_number: string | null;
  type: InvoiceType | null;
  created_at: Date;
  due_date: Date;
  total_including_fee: number;
  customer_has_paid: boolean;
  to_credit_note: boolean;
  to_debt_collection: boolean;
  to_loss_note: boolean;
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
      "customer_has_paid",
      "to_credit_note",
      "to_debt_collection",
      "to_loss_note",
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
    status: invoiceStatus({
      customerHasPaid: row.customer_has_paid,
      toCreditNote: row.to_credit_note,
      toDebtCollection: row.to_debt_collection,
      toLossNote: row.to_loss_note,
    }),
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
