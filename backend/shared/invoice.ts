import type { CustomerItemType } from "#shared/customer-item/customer-item-type";

/**
 * "loan" was a type option in legacy bl-admin's invoice generator until 2021. It selected the same
 * customer items as "rent" and only tagged the invoice differently, so it is no longer offered,
 * but the invoices it produced still exist and export like rent invoices.
 */
export type InvoiceType = CustomerItemType | "loan";

/** Amounts are in kroner; company invoices are written by hand and may carry øre. */
export interface InvoiceLine {
  /** Null on company invoice lines, which are not tied to a book we lent out. */
  customerItemId: string | null;
  itemId: string | null;
  customerItemType: CustomerItemType | null;
  /** The title when the invoice was made. */
  title: string;
  /** Only on company invoice lines. */
  productNumber: number | null;
  numberOfItems: number;
  /** Struck from the invoice by an admin. */
  cancelled: boolean;
  /** Price per unit without VAT. */
  unit: number;
  gross: number;
  net: number;
  vat: number;
  /** In percent. */
  discount: number;
}

/**
 * An invoice is an accounting document: the customer fields are a copy of the customer when the
 * invoice was made and outlive them, while `customerId` links to the customer only as long as they
 * exist.
 */
export interface Invoice {
  id: string;
  /**
   * e.g. 201810000; see {@link invoiceBatchPrefix}. Unique; the credited originals of two numbers
   * reissued in 2020 carry a `-K` suffix.
   */
  invoiceNumber: string;
  /** Null on company invoices and the oldest invoices. */
  type: InvoiceType | null;
  /** `YYYY-MM-DD`. */
  dueDate: string;
  status: InvoiceStatus;
  /** Null on company invoices. */
  branchId: string | null;
  /** The branch's current name, printed on the invoice. */
  branchName: string | null;
  /** Null on company invoices and once the customer is deleted. */
  customerId: string | null;
  /** The number the accounting systems know the customer by. */
  customerNumber: string;
  /** The contact fields are null when the customer had not given them. */
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  /** A calendar date (yyyy-MM-dd); company invoices have none. */
  customerDob: string | null;
  /** Only company invoices carry one, which is how they are told apart. */
  customerOrganizationNumber: string | null;
  customerAddress: string | null;
  customerPostCode: string | null;
  /** Only company invoices carry a country. */
  customerCountry: string | null;
  /** Sums of the lines and the fee. */
  totalGross: number;
  totalNet: number;
  totalVat: number;
  /** The sum of the line discounts, not a percentage of the total. */
  totalDiscount: number;
  /** The fee is on pupils' invoices only; company invoices have null in all five. */
  feeUnit: number | null;
  feeGross: number | null;
  feeNet: number | null;
  feeVat: number | null;
  feeDiscount: number | null;
  /** totalGross, which already includes the fee. */
  totalIncludingFee: number;
  /** e.g. 'Manglende levering av skolebøker' */
  reference: string;
  ourReference: string | null;
  /** Only company invoices carry a comment. */
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
  lines: InvoiceLine[];
}

/** Where the invoice stands; one value, since legacy bl-admin's four flags were never combined. */
export const INVOICE_STATUSES = [
  "unpaid",
  "paid",
  "credit-note",
  "debt-collection",
  "loss-note",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_EXPORT_FORMATS = ["tripletex", "visma", "visma-credit", "visma-ehf"] as const;
export type InvoiceExportFormat = (typeof INVOICE_EXPORT_FORMATS)[number];

/**
 * Invoices are numbered YYYY + a batch digit + a running number, so the first five digits
 * identify the batch (a generation run, or the year's company invoices).
 */
const INVOICE_BATCH_PREFIX_LENGTH = 5;

export function invoiceBatchPrefix(invoiceNumber: string): string {
  return invoiceNumber.slice(0, INVOICE_BATCH_PREFIX_LENGTH);
}

/** One row of the invoice list. The full document is fetched when a row is opened. */
export interface InvoiceListRow {
  id: string;
  invoiceNumber: string;
  customerName: string | null;
  /** Null for company invoices and once the customer is deleted. */
  customerId: string | null;
  customerOrganizationNumber: string | null;
  type: InvoiceType | null;
  createdAt: Date;
  /** `YYYY-MM-DD`. */
  dueDate: string;
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
  /** Customer items with a deadline in [deadlineFrom, deadlineTo] are invoiced, both `YYYY-MM-DD`. */
  deadlineFrom: string;
  deadlineTo: string;
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
  /** On a dry run the invoices are not saved, and each row's id is its invoice number. */
  invoices: InvoiceListRow[];
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
 * Legacy bl-admin's line arithmetic, kept as it was so new company invoices match the ones already in
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
  /** `YYYY-MM-DD`. */
  dueDate: string;
  comment?: string;
  lines: CompanyInvoiceLine[];
}

/** The status change succeeded; any side effect that could not be applied is listed. */
export interface InvoiceStatusChangeResult {
  invoice: Invoice;
  warnings: string[];
}

/** Every invoice was updated; the warnings name the invoice they concern. */
export interface InvoiceBulkStatusChangeResult {
  invoices: Invoice[];
  warnings: string[];
}
