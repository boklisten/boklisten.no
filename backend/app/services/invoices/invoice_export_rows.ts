import moment from "moment-timezone";

import type { CsvCell } from "#services/invoices/csv";
import type { Branch } from "#shared/branch";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Invoice, InvoiceCustomerItemPayment } from "#shared/invoice";
import type { Item } from "#shared/item";

/**
 * Row builders for the Visma and Tripletex invoice imports, ported field for field from
 * bl-admin's InvoiceVismaService. The files are uploaded to external accounting systems, so the
 * values must stay exactly as they were, quirks included. Each quirk that is kept on purpose is
 * commented at the place it happens.
 *
 * bl-admin formatted dates in the browser's timezone; employees sit in Norway, so this formats
 * in Europe/Oslo regardless of where the server runs.
 */
const TIMEZONE = "Europe/Oslo";
const FEE_TITLE = "Administrasjonsgebyr";
const FEE_ARTICLE_NUMBER = "1000";
const TEXT_LINES = {
  title: {
    rent: "Fakturaen gjelder manglende/for sent leverte bøker fra forrige semester hos: ",
    "partly-payment":
      "Faktura gjelder manglende betaling av andre avdrag fra forrige semester hos: ",
  },
  dob: "Kundens fødselsdato: ",
  phone: "Kundens telefonnummer: ",
  contact: "Alle fakturahenvendelser sendes til info@boklisten.no",
} as const;
/** Invoices created before this date get customer numbers from the old, less unique scheme. */
const NEW_MINI_ID_FROM = "2023-01-25";

function formatExportDate(date: Date | string | undefined, format: string): string {
  // bl-admin called moment(undefined), which is "now". A missing date of birth therefore printed
  // as today's date, and still does.
  return moment.tz(date, TIMEZONE).format(format);
}

function mongoIdEpoch(mongoId: string): number {
  return new Date(Number.parseInt(mongoId.slice(0, 8), 16)).getTime();
}

function cantorPair(a: number, b: number): number {
  return ((a + b) * (a + b + 1)) / 2 + b;
}

function newMongoMiniId(mongoId: string): number {
  const epoch = mongoIdEpoch(mongoId);
  const increment = Number.parseInt(mongoId.slice(-6), 16);
  // The middle of the pair has the most entropy, so it is the least likely to collide.
  return Number(String(cantorPair(epoch, increment)).slice(6, 14));
}

function mongoIdMiniEpoch(mongoId: string): number {
  return Math.trunc(Number(String(mongoIdEpoch(mongoId)).slice(2)));
}

/** Article number for a book: the counter part of its Mongo id. */
export function mongoIdCounter(mongoId: string): number {
  return Number.parseInt(mongoId.slice(18, 24), 16);
}

/**
 * The customer number Visma and Tripletex know a pupil by, derived from the user detail id.
 * The derivation changed on 2023-01-25; older invoices keep the old number so re-exports match.
 */
export function invoiceMiniId(invoice: Invoice): number {
  const userDetail = String(invoice.customerInfo.userDetail);
  return moment.tz(invoice.creationTime, TIMEZONE).isBefore(moment.tz(NEW_MINI_ID_FROM, TIMEZONE))
    ? mongoIdMiniEpoch(userDetail)
    : newMongoMiniId(userDetail);
}

/** bl-admin treated an empty string like a missing value in these fields. */
function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value === "" ? undefined : value;
}

function customerNumber(invoice: Invoice): string | undefined {
  return invoice.customerInfo.userDetail
    ? String(invoiceMiniId(invoice))
    : invoice.customerInfo.customerNumber;
}

function inOre(amount: number): number {
  return amount * 100;
}

export interface VismaExportOptions {
  ehf: boolean;
  /** Export as credit notes (H3 header) of already sent invoices. */
  creditOfInvoice: boolean;
}

export function vismaRows(invoices: Invoice[], options: VismaExportOptions): CsvCell[][] {
  return invoices.flatMap((invoice) => vismaRowsForInvoice(invoice, options));
}

function vismaRowsForInvoice(invoice: Invoice, options: VismaExportOptions): CsvCell[][] {
  const rows: CsvCell[][] = [];
  let lineNumber = 0;
  rows.push(
    options.creditOfInvoice
      ? vismaH3(lineNumber, invoice)
      : vismaH1(lineNumber, invoice, options.ehf),
  );
  lineNumber++;

  for (const customerItemPayment of invoice.customerItemPayments) {
    rows.push(vismaL1(lineNumber, invoice.invoiceId, customerItemPayment));
    lineNumber++;
  }

  if (invoice.payment.fee) {
    rows.push(vismaL1Fee(lineNumber, invoice));
    lineNumber++;
  }

  if (invoice.customerInfo.organizationNumber) {
    for (const comment of invoice.comments ?? []) {
      rows.push(vismaL1Text(lineNumber, invoice.invoiceId, comment.msg));
      lineNumber++;
    }
  } else {
    const title =
      invoice.type === undefined ||
      invoice.type === null ||
      invoice.type === "rent" ||
      invoice.type === "loan"
        ? TEXT_LINES.title.rent
        : TEXT_LINES.title["partly-payment"];
    const branchName = invoice.customerInfo.branchName;
    rows.push(
      vismaL1Text(lineNumber, invoice.invoiceId, title + branchName),
      vismaL1Text(
        lineNumber + 1,
        invoice.invoiceId,
        TEXT_LINES.dob + formatExportDate(invoice.customerInfo.dob, "DD.MM.YYYY"),
      ),
      vismaL1Text(lineNumber + 2, invoice.invoiceId, TEXT_LINES.phone + invoice.customerInfo.phone),
      vismaL1Text(lineNumber + 3, invoice.invoiceId, TEXT_LINES.contact),
    );
  }
  return rows;
}

function vismaH3(lineNumber: number, invoice: Invoice): CsvCell[] {
  return [
    "H3", // 1 Record Type (M)
    lineNumber, // 2 Line number (M)
    customerNumber(invoice), // 3 Customer no (M)
    invoice.invoiceId, // 4 Invoice number (M)
  ];
}

function vismaH1(lineNumber: number, invoice: Invoice, ehf: boolean): CsvCell[] {
  const { customerInfo, payment } = invoice;
  const dobOrOrganizationNumber =
    nonEmpty(customerInfo.organizationNumber) ?? formatExportDate(customerInfo.dob, "DDMMYYYY");
  return [
    "H1", // 1 Record Type (M)
    lineNumber, // 2 Line number (M)
    customerNumber(invoice), // 3 Customer no (M)
    customerInfo.name, // 4 Customer name (M)
    customerInfo.postal.address, // 5 Address 1
    "", // 6 Address 2
    customerInfo.postal.code, // 7 Postal code (M)
    customerInfo.postal.city, // 8 City (M)
    customerInfo.postal.country, // 9 Country
    customerInfo.phone, // 10 Customer phone (M)
    "", // 11 Customer Fax
    customerInfo.email, // 12 Customer Email
    formatExportDate(invoice.creationTime, "DDMMYYYY"), // 13 Invoice Date (M)
    "", // 14 Credit Invoice
    invoice.invoiceId, // 15 Invoice number (M)
    "", // 16 KID/ODCR
    "", // 17 Currency
    "", // 18 Exchange Rate
    formatExportDate(invoice.duedate, "DDMMYYYY"), // 19 Invoice due date (M)
    dobOrOrganizationNumber, // 20 Customer organisation no
    inOre(payment.total.gross), // 21 Invoice gross amount (M)
    inOre(payment.total.net), // 22 Invoice net amount (M)
    inOre(payment.total.vat), // 23 VAT (M)
    payment.total.gross >= 0 ? "IN" : "CR", // 24 Document Type (M): IN = invoice, CR = credit note
    "", // 25 Order number
    "", // 26 Project Number
    "", // 27 Department/Dimension
    nonEmpty(customerInfo.branchName) ?? invoice.ourReference, // 28 Our reference
    "", // 29 Your reference
    invoice.reference, // 30 Reference
    "", // 31 Ref. 1
    "", // 32 Ref. 2
    "", // 33 Ref. 3
    "", // 34 Ref. 4
    ehf ? "H" : "P", // 35 Distribution channel: P = postal, M = email, H = EHF
    "", // 36 Cent rounding threshold
    "P", // 37 Brand
    "", // 38 Amount type
    customerInfo.name, // 39 Delivery address name
    customerInfo.postal.address, // 40 Delivery address 1
    "", // 41 Delivery address 2
    customerInfo.postal.code, // 42 Delivery address Postal code
    customerInfo.postal.city, // 43 Delivery address city
    customerInfo.postal.country, // 44 Delivery address country
    "", // 45 Rating Date
    "", // 46 Rating poeng
    "", // 47 Client ID
    customerInfo.email, // 48 Delivery address Email
    "", // 49 Postal charge
    "", // 50 Fees
    "", // 51 Discount
    "", // 52 Add-ons or reduction
    "", // 53 Set reminder flag
    "", // 54 Set interest flag
    "", // 55 Invoice address name
    "", // 56 Invoice address 1
    "", // 57 Invoice address 2
    "", // 58 Invoice Postal Code
    "", // 59 Invoice City
    "", // 60 Invoice Country
    "", // 61 Marketing message code
    ehf ? "EHF" : "", // 62 eInvoice code
    ehf ? customerInfo.organizationNumber : "", // 63 eInvoice Reference: the org number for EHF
    "", // 64 VAT Code fields 49-52
    "", // 65 Invoice address Email
    "", // 66 Settlement ratio
    "", // 67 General ledger dimension A
    "", // 68 General ledger dimension B
    "", // 69 For future use
    "", // 70 Attachment
    "", // 71 Customer code(s)
  ];
}

const L1_TRAILING_FIELDS: CsvCell[] = Array.from({ length: 25 }, () => ""); // fields 15–39

function vismaL1(
  lineNumber: number,
  invoiceId: string | undefined,
  customerItemPayment: InvoiceCustomerItemPayment,
): CsvCell[] {
  const { payment } = customerItemPayment;
  return [
    "L1", // 1 Record type
    lineNumber, // 2 Line number
    invoiceId, // 3 Invoice number
    "V", // 4 Line type (M)
    payment.vat <= 0 ? "FRI" : "PLH", // 5 VAT type (M)
    customerItemPayment.item
      ? String(mongoIdCounter(String(customerItemPayment.item)))
      : customerItemPayment.productNumber, // 6 Article number
    customerItemPayment.title, // 7 Article name (M)
    customerItemPayment.numberOfItems, // 8 Invoiced quantity (M)
    payment.discount, // 9 Discount %
    "", // 10 Currency
    inOre(payment.gross), // 11 Gross amount (M)
    inOre(payment.unit), // 12 Price per unit without VAT
    inOre(payment.net), // 13 Net amount (M)
    inOre(payment.vat), // 14 VAT amount (M)
    ...L1_TRAILING_FIELDS,
  ];
}

function vismaL1Fee(lineNumber: number, invoice: Invoice): CsvCell[] {
  const fee = invoice.payment.fee;
  if (!fee) {
    throw new Error("fee line requested for an invoice without a fee");
  }
  return [
    "L1", // 1 Record type
    lineNumber, // 2 Line number
    invoice.invoiceId, // 3 Invoice number
    "V", // 4 Line type (M)
    "PLH", // 5 VAT type (M)
    FEE_ARTICLE_NUMBER, // 6 Article number
    FEE_TITLE, // 7 Article name (M)
    invoice.customerItemPayments.length, // 8 Invoiced quantity (M)
    invoice.payment.total.discount, // 9 Discount %
    "", // 10 Currency
    inOre(fee.gross), // 11 Gross amount (M)
    inOre(fee.unit), // 12 Price per unit without VAT
    inOre(fee.net), // 13 Net amount (M)
    inOre(fee.vat), // 14 VAT amount (M)
    ...L1_TRAILING_FIELDS,
  ];
}

function vismaL1Text(lineNumber: number, invoiceId: string | undefined, text: string): CsvCell[] {
  return [
    "L1", // 1 Record type
    lineNumber, // 2 Line number
    invoiceId, // 3 Invoice number
    "K", // 4 Line type (M)
    "txt", // 5 VAT type (M)
    "", // 6 Article number
    text, // 7 Article name (M)
    "", // 8 Invoiced quantity
    "", // 9 Discount %
    "", // 10 Currency
    "", // 11 Gross amount
    "", // 12 Price per unit without VAT
    "", // 13 Net amount
    "", // 14 VAT amount
    ...L1_TRAILING_FIELDS,
  ];
}

export const TRIPLETEX_HEADERS = [
  "INVOICE NO",
  "INVOICE DATE",
  "DUE DATE",
  "KID",
  "PAYMENT TYPE",
  "PAID AMOUNT",
  "ORDER NO",
  "ORDER DATE",
  "CUSTOMER NO",
  "CUSTOMER NAME",
  "ORGANIZATION NO",
  "CUSTOMER EMAIL",
  "CUSTOMER PHONE",
  "CUSTOMER MOBILE",
  "POSTAL ADDR - LINE 1",
  "POSTAL ADDR - LINE 2",
  "POSTAL ADDR - POSTAL NO",
  "POSTAL ADDR - CITY",
  "POSTAL ADDR - COUNTRY",
  "BUSINESS ADDR - LINE 1",
  "BUSINESS ADDR - LINE 2",
  "BUSINESS ADDR - POSTAL NO",
  "BUSINESS ADDR - CITY ",
  "BUSINESS ADDR - COUNTRY",
  "CUSTOMER CAT 1 - NO",
  "CUSTOMER CAT 1 - NAME",
  "CUSTOMER CAT 2 - NO",
  "CUSTOMER CAT 2 - NAME",
  "CUSTOMER CAT 3 - NO",
  "CUSTOMER CAT 3 - NAME",
  "CONTACT - FIRST NAME",
  "CONTACT - LAST NAME ",
  "ATTN - FIRST NAME",
  "ATTN - LAST NAME",
  "REFERENCE NO",
  "DEPARTMENT NO ",
  "DEPARTMENT NAME",
  "PROJECT NO",
  "PROJECT NAME",
  "COMMENTS",
  "CURRENCY",
  "DELIVERY DATE",
  "DELIVERY ADDR - LINE 1",
  "DELIVERY ADDR - LINE 2",
  "DELIVERY ADDR - POSTAL NO",
  "DELIVERY ADDR - CITY",
  "DELIVERY ADDR - COUNTRY",
  "INVENTORY NO",
  "INVENTORY NAME",
  "ORDER LINE - PROD NO",
  "ORDER LINE - PROD NAME",
  "ORDER LINE - DESCRIPTION",
  "ORDER LINE - UNIT PRICE",
  "ORDER LINE - COUNT",
  "ORDER LINE - DISCOUNT",
  "ORDER LINE - VAT CODE",
] as const;

const TRIPLETEX_EMPTY_CATEGORY_FIELDS = Array.from({ length: 15 }, () => ""); // fields 20–34

/** Everything a Tripletex export needs besides the invoices themselves. */
export interface TripletexLookups {
  customerItems: Map<string, CustomerItem>;
  items: Map<string, Item>;
  branches: Map<string, Branch>;
}

function required<T>(map: Map<string, T>, id: string | null | undefined, what: string): T {
  const value = id ? map.get(id) : undefined;
  if (value === undefined) {
    throw new Error(`${what} ${id} finnes ikke`);
  }
  return value;
}

export function tripletexRows(invoices: Invoice[], lookups: TripletexLookups): CsvCell[][] {
  const rows: CsvCell[][] = [[...TRIPLETEX_HEADERS]];
  for (const invoice of invoices) {
    const invoiceDate = formatExportDate(invoice.creationTime, "YYYY-MM-DD");
    const dueDate = formatExportDate(invoice.duedate, "YYYY-MM-DD");
    const customerFields = [
      invoiceMiniId(invoice).toString(),
      invoice.customerInfo.name,
      "",
      invoice.customerInfo.email,
      invoice.customerInfo.phone,
      "",
      invoice.customerInfo.postal.address,
      "",
      invoice.customerInfo.postal.code,
      invoice.customerInfo.postal.city,
      "NO",
      ...TRIPLETEX_EMPTY_CATEGORY_FIELDS,
      invoice.reference,
      "",
      "",
      "",
      "",
    ];
    let isFirstItem = true;
    for (const customerItemPayment of invoice.customerItemPayments) {
      const customerItem = required(
        lookups.customerItems,
        customerItemPayment.customerItem,
        "Kundeboka",
      );
      const item = required(lookups.items, customerItem.item, "Boka");
      const handoutBranch = required(
        lookups.branches,
        customerItem.handoutInfo?.handoutById,
        "Filialen",
      );
      const orderDate = formatExportDate(customerItem.creationTime, "YYYY-MM-DD");
      rows.push([
        invoice.invoiceId,
        invoiceDate,
        dueDate,
        "",
        "",
        "",
        customerItem.orders.at(-1),
        orderDate,
        ...customerFields,
        isFirstItem
          ? `Faktura gjelder manglende betaling av andre avdrag ved ${handoutBranch.name}. Ved henvendelser om denne faktura, send mail til info@boklisten.no`
          : "",
        "NOK",
        orderDate,
        handoutBranch.name,
        handoutBranch.location.address,
        // Branches have no postal code or city; these were always empty.
        "",
        "",
        "",
        "",
        "",
        String(item.info.isbn),
        item.title,
        "",
        // bl-admin exported the stored amount, which is 0 for books moved between orders.
        String(customerItem.amountLeftToPay),
        "1",
        "0",
        "5",
      ]);
      isFirstItem = false;
    }
    rows.push([
      invoice.invoiceId,
      invoiceDate,
      dueDate,
      "",
      "",
      "",
      invoice.invoiceId,
      invoiceDate,
      ...customerFields,
      "",
      "NOK",
      invoiceDate,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      FEE_ARTICLE_NUMBER,
      FEE_TITLE,
      "",
      String(invoice.payment.fee?.unit),
      String(invoice.customerItemPayments.length),
      String(invoice.payment.total.discount),
      "3",
    ]);
  }
  return rows;
}
