import type { BlDocument } from "#shared/bl-document";
import type { CustomerItemType } from "#shared/customer-item/customer-item-type";

/**
 * "loan" was a type option in bl-admin's invoice generator until 2021. It selected the same
 * customer items as "rent" and only tagged the invoice differently, so it is no longer offered,
 * but the invoices it produced still exist and export like rent invoices.
 */
export type InvoiceType = CustomerItemType | "loan";

export interface InvoiceCustomerItemPayment {
  /** Missing on company invoice lines, which are not tied to a book we lent out. */
  customerItem?: string | null;
  productNumber?: number;
  item?: string | null;
  title: string;
  numberOfItems: number;
  customerItemType?: CustomerItemType | null;
  cancel?: boolean;
  payment: {
    unit: number; // price per unit without vat
    gross: number;
    net: number;
    vat: number;
    discount: number; // in percentage
  };
}

export interface Invoice extends BlDocument {
  duedate: Date;
  /** Missing on the oldest invoices and null on company invoices. */
  type?: InvoiceType | null;
  customerHavePayed: boolean;
  toDebtCollection: boolean;
  toCreditNote: boolean;
  toLossNote: boolean;
  branch?: string;
  customerItemPayments: InvoiceCustomerItemPayment[];
  customerInfo: {
    userDetail?: string;
    companyDetail?: string;
    customerNumber?: string;
    name: string;
    branchName?: string;
    organizationNumber?: string;
    email: string;
    phone: string;
    dob?: Date;
    postal: {
      address: string;
      city: string;
      code: string;
      /** Only company invoices carry a country; pupils' invoices never did. */
      country?: string;
    };
  };
  payment: {
    total: {
      // amounts are a sum of all items
      gross: number;
      net: number;
      vat: number;
      discount: number; // in percentage
    };
    /** Pupils' invoices carry a fee; company invoices store null. */
    fee?: {
      unit: number; // fee per unit without vat
      gross: number;
      net: number;
      vat: number;
      discount: number; // in percentage
    } | null;
    totalIncludingFee: number; // total.gross + fee.gross
  };
  ourReference?: string;
  invoiceId?: string; // ex. 201810000
  reference?: string; // ex. 'Not delivered books in time'
  comments?: InvoiceComment[];
}

export interface InvoiceComment {
  msg: string;
  creationTime: Date;
}

/**
 * The four status flags on an invoice are mutually exclusive in practice (bl-admin cleared the
 * others whenever one was set), so the API presents them as one status.
 */
export const INVOICE_STATUSES = [
  "unpaid",
  "paid",
  "creditNote",
  "debtCollection",
  "lossNote",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

type InvoiceStatusFlags = Pick<
  Invoice,
  "customerHavePayed" | "toCreditNote" | "toDebtCollection" | "toLossNote"
>;

/** Old data may have several flags set; the first match wins, in the order bl-admin coloured rows. */
export function invoiceStatus(flags: InvoiceStatusFlags): InvoiceStatus {
  if (flags.toDebtCollection) {
    return "debtCollection";
  }
  if (flags.customerHavePayed) {
    return "paid";
  }
  if (flags.toCreditNote) {
    return "creditNote";
  }
  if (flags.toLossNote) {
    return "lossNote";
  }
  return "unpaid";
}

export function invoiceStatusFlags(status: InvoiceStatus): InvoiceStatusFlags {
  return {
    customerHavePayed: status === "paid",
    toCreditNote: status === "creditNote",
    toDebtCollection: status === "debtCollection",
    toLossNote: status === "lossNote",
  };
}

export const INVOICE_EXPORT_FORMATS = ["tripletex", "visma", "visma-credit", "visma-ehf"] as const;
export type InvoiceExportFormat = (typeof INVOICE_EXPORT_FORMATS)[number];

/**
 * Invoices are numbered YYYY + a batch digit + a running number, so the first five digits
 * identify the batch (a generation run, or the year's company invoices).
 */
export interface InvoiceBatch {
  prefix: string;
  count: number;
  type: InvoiceType | null;
  company: boolean;
  firstCreated: Date | null;
}

/** One row of the invoice list. The full document is fetched when a row is opened. */
export interface InvoiceListRow {
  id: string;
  invoiceId: string;
  customerName: string;
  organizationNumber: string | null;
  type: InvoiceType | null;
  duedate: Date;
  totalIncludingFee: number;
  status: InvoiceStatus;
}

export interface InvoiceExportFile {
  filename: string;
  csv: string;
}

export const GENERATABLE_INVOICE_TYPES = [
  "partly-payment",
  "rent",
] as const satisfies InvoiceType[];
export type GeneratableInvoiceType = (typeof GENERATABLE_INVOICE_TYPES)[number];

export interface InvoiceGenerationSettings {
  type: GeneratableInvoiceType;
  /** Customer items with a deadline in [deadlineFrom, deadlineTo] are invoiced. */
  deadlineFrom: Date;
  deadlineTo: Date;
  /** The first invoice number; each customer gets the next one. */
  invoiceNumber: number;
  /** Fee per book, without VAT. */
  fee: number;
  /** VAT on the fee as a fraction, e.g. 0.25. */
  feeVatPercentage: number;
  /** The book price is multiplied by this to get the invoiced amount, e.g. 1.1 or 0.33. */
  feePercentage: number;
  daysToDeadline: number;
  reference: string;
}

/** Defaults for the generator, taken from the newest batch of the same type. */
export interface InvoiceGenerationDefaults {
  fee: number;
  feeVatPercentage: number;
  feePercentage: number;
  daysToDeadline: number;
  reference: string;
}

export interface InvoiceGenerationResult {
  invoices: Invoice[];
  /** Customer items that could not be invoiced, e.g. because the customer no longer exists. */
  skipped: { customerItemId: string; reason: string }[];
}

export interface CompanyInvoiceLine {
  title: string;
  productNumber: number;
  /** Price per unit without VAT. */
  price: number;
  numberOfUnits: number;
  /** Discount in percent, e.g. 40 for 40 %. */
  discount: number;
  /** VAT in percent, e.g. 25 for 25 %. */
  taxPercentage: number;
}

/**
 * bl-admin's line arithmetic, kept as it was so new company invoices match the ones already in
 * the books: VAT is one unit's tax before discount, and the gross is rounded to two decimals.
 */
export function companyLinePayment(line: CompanyInvoiceLine) {
  const tax = line.taxPercentage === 0 ? 0 : line.price * (line.taxPercentage / 100);
  const discountFactor = 1 - line.discount / 100;
  const gross = Number(((line.price + tax) * discountFactor * line.numberOfUnits).toFixed(2));
  return {
    unit: line.price,
    gross,
    net: Number((gross - tax).toFixed(2)),
    vat: tax,
    discount: line.discount,
  };
}

export interface CompanyInvoiceInput {
  companyId: string;
  invoiceNumber: string;
  reference: string;
  ourReference: string;
  duedate: Date;
  comment?: string;
  lines: CompanyInvoiceLine[];
}

/** The status change succeeded; any side effect that could not be applied is listed. */
export interface InvoiceStatusChangeResult {
  invoice: Invoice;
  warnings: string[];
}
