import { Exception } from "@adonisjs/core/exceptions";
import db from "@adonisjs/lucid/services/db";
import { beforeCreate, beforeFetch, beforeFind, hasMany } from "@adonisjs/lucid/orm";
import type { ModelQueryBuilderContract } from "@adonisjs/lucid/types/model";
import type { HasMany } from "@adonisjs/lucid/types/relations";

import Branch from "#models/branch";
import { assignObjectId } from "#models/helpers/object_id";
import InvoiceLine from "#models/invoice_line";
import { InvoiceSchema } from "#database/schema";
import type { Invoice as InvoiceDto, InvoiceType } from "#shared/invoice";

type InvoiceColumns = Pick<Invoice, (typeof InvoiceSchema.$columns)[number]>;
type InvoiceLineColumns = Pick<InvoiceLine, (typeof InvoiceLine.$columns)[number]>;

/** The columns a new line is given; the rest take their defaults. */
export type NewInvoiceLine = Omit<InvoiceLineColumns, "id" | "invoiceId" | "position" | "cancel">;

type DefaultedInvoiceColumns =
  | "id"
  | "createdAt"
  | "updatedAt"
  | "customerHasPaid"
  | "toCreditNote"
  | "toDebtCollection"
  | "toLossNote";

/**
 * The columns a new invoice is given, with its lines in the order they are printed. The id,
 * timestamps and status flags take their defaults unless given.
 */
export type NewInvoice = Omit<InvoiceColumns, DefaultedInvoiceColumns> &
  Partial<Pick<InvoiceColumns, DefaultedInvoiceColumns>> & { lines: NewInvoiceLine[] };

/**
 * An invoice and its lines (see `shared/invoice.ts` for the field semantics). The customer
 * columns are a copy of the customer when the invoice was made and are never updated; `customerId`
 * is set to NULL when the customer is deleted.
 *
 * Every read through this model preloads the lines in `position` order (hooks below). Create
 * invoices with `Invoice.createWithLines`.
 */
export default class Invoice extends InvoiceSchema {
  static override selfAssignPrimaryKey = true;

  declare type: InvoiceType | null;

  @hasMany(() => InvoiceLine)
  declare lines: HasMany<typeof InvoiceLine>;

  @beforeCreate()
  static assignId(invoice: Invoice) {
    assignObjectId(invoice);
  }

  @beforeFind()
  static preloadLinesOnFind(query: ModelQueryBuilderContract<typeof Invoice>) {
    Invoice.preloadLines(query);
  }

  @beforeFetch()
  static preloadLinesOnFetch(query: ModelQueryBuilderContract<typeof Invoice>) {
    Invoice.preloadLines(query);
  }

  static preloadLines(query: ModelQueryBuilderContract<typeof Invoice>) {
    void query.preload("lines", (lines) => {
      void lines.orderBy("position");
    });
  }

  /** `findOrFail` with the Norwegian not-found message the API shows. */
  static async getOrFail(id: string): Promise<Invoice> {
    const invoice = await this.find(id);
    if (invoice === null) {
      throw new Exception(`Fant ikke faktura ${id}`, { status: 404, code: "E_ROW_NOT_FOUND" });
    }
    return invoice;
  }

  /** Inserts the invoice and its lines in one transaction and returns it read back. */
  static async createWithLines({ lines, ...columns }: NewInvoice): Promise<Invoice> {
    return db.transaction(async (trx) => {
      const invoice = await Invoice.create(columns, { client: trx });
      await invoice
        .related("lines")
        .createMany(lines.map((line, position) => ({ ...line, position })));
      return Invoice.query({ client: trx }).where("id", invoice.id).firstOrFail();
    });
  }

  /**
   * Whether the customer has an invoice that still asks for money: neither paid nor credited.
   * Debt collection and loss notes count as active.
   */
  static async hasActive(customerId: string): Promise<boolean> {
    const row = await db
      .from("invoices")
      .where("customer_id", customerId)
      .where("customer_has_paid", false)
      .where("to_credit_note", false)
      .first();
    return row !== null;
  }

  /** The invoices as the API shows them, with each branch's current name. */
  static async toDtos(invoices: Invoice[]): Promise<InvoiceDto[]> {
    const names = await Branch.namesByIds(invoices.map((invoice) => invoice.branchId));
    return invoices.map((invoice) =>
      invoice.toDto(invoice.branchId === null ? null : (names.get(invoice.branchId) ?? null)),
    );
  }

  toDto(branchName: string | null): InvoiceDto {
    return {
      id: this.id,
      invoiceNumber: this.invoiceNumber,
      type: this.type,
      dueDate: this.dueDate.toJSDate(),
      customerHasPaid: this.customerHasPaid,
      toCreditNote: this.toCreditNote,
      toDebtCollection: this.toDebtCollection,
      toLossNote: this.toLossNote,
      branchId: this.branchId,
      branchName,
      customerId: this.customerId,
      customerNumber: this.customerNumber,
      customerName: this.customerName,
      customerEmail: this.customerEmail,
      customerPhone: this.customerPhone,
      customerDob: this.customerDob?.toISODate() ?? null,
      customerOrganizationNumber: this.customerOrganizationNumber,
      customerAddress: this.customerAddress,
      customerPostCode: this.customerPostCode,
      customerPostCity: this.customerPostCity,
      customerCountry: this.customerCountry,
      totalGross: this.totalGross,
      totalNet: this.totalNet,
      totalVat: this.totalVat,
      totalDiscount: this.totalDiscount,
      feeUnit: this.feeUnit,
      feeGross: this.feeGross,
      feeNet: this.feeNet,
      feeVat: this.feeVat,
      feeDiscount: this.feeDiscount,
      totalIncludingFee: this.totalIncludingFee,
      reference: this.reference,
      ourReference: this.ourReference,
      comment: this.comment,
      createdAt: this.createdAt.toJSDate(),
      updatedAt: this.updatedAt.toJSDate(),
      lines: this.lines.map((line) => line.toDto()),
    };
  }
}
