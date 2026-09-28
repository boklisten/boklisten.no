import { DateTime } from "luxon";

import type { CsvCell } from "#services/invoices/csv";
import type { Branch } from "#shared/branch";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Invoice, InvoiceLine } from "#shared/invoice";
import type { Item } from "#shared/item";

/**
 * Row builders for the Visma and Tripletex invoice imports, ported field for field from
 * Legacy bl-admin's InvoiceVismaService. The files are uploaded to external accounting systems, so the
 * values must stay exactly as they were, quirks included. Each quirk that is kept on purpose is
 * commented at the place it happens.
 *
 * Legacy bl-admin formatted dates in the browser's timezone; employees sit in Norway, so this formats
 * in Europe/Oslo (the app's default zone) regardless of where the server runs.
 */
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
function formatExportDate(date: Date, format: string): string {
  return DateTime.fromJSDate(date).toFormat(format);
}

function formatDob(dob: string | null, format: string): string {
  // Legacy bl-admin called moment(undefined), which is "now". A missing date of birth therefore printed
  // as today's date, and still does.
  return (dob === null ? DateTime.now() : DateTime.fromISO(dob)).toFormat(format);
}

/** Article number for a book: the counter part of its ObjectId. */
export function objectIdCounter(objectId: string): number {
  return Number.parseInt(objectId.slice(18, 24), 16);
}

/** Legacy bl-admin treated an empty string like a missing value in these fields. */
function nonEmpty(value: string | null): string | null {
  return value === "" ? null : value;
}

function inOre(amount: number): number {
  return amount * 100;
}

interface VismaExportOptions {
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

  for (const line of invoice.lines) {
    rows.push(vismaL1(lineNumber, invoice.invoiceNumber, line));
    lineNumber++;
  }

  if (invoice.feeGross !== null) {
    rows.push(vismaL1Fee(lineNumber, invoice));
    lineNumber++;
  }

  if (invoice.customerOrganizationNumber) {
    if (invoice.comment !== null) {
      rows.push(vismaL1Text(lineNumber, invoice.invoiceNumber, invoice.comment));
      lineNumber++;
    }
  } else {
    const title =
      invoice.type === null || invoice.type === "rent" || invoice.type === "loan"
        ? TEXT_LINES.title.rent
        : TEXT_LINES.title["partly-payment"];
    rows.push(
      vismaL1Text(lineNumber, invoice.invoiceNumber, title + (invoice.branchName ?? "")),
      vismaL1Text(
        lineNumber + 1,
        invoice.invoiceNumber,
        TEXT_LINES.dob + formatDob(invoice.customerDob, "dd.MM.yyyy"),
      ),
      vismaL1Text(
        lineNumber + 2,
        invoice.invoiceNumber,
        TEXT_LINES.phone + (invoice.customerPhone ?? ""),
      ),
      vismaL1Text(lineNumber + 3, invoice.invoiceNumber, TEXT_LINES.contact),
    );
  }
  return rows;
}

function vismaH3(lineNumber: number, invoice: Invoice): CsvCell[] {
  return [
    "H3", // 1 Record Type (M)
    lineNumber, // 2 Line number (M)
    invoice.customerNumber, // 3 Customer no (M)
    invoice.invoiceNumber, // 4 Invoice number (M)
  ];
}

function vismaH1(lineNumber: number, invoice: Invoice, ehf: boolean): CsvCell[] {
  const dobOrOrganizationNumber =
    nonEmpty(invoice.customerOrganizationNumber) ?? formatDob(invoice.customerDob, "ddMMyyyy");
  return [
    "H1", // 1 Record Type (M)
    lineNumber, // 2 Line number (M)
    invoice.customerNumber, // 3 Customer no (M)
    invoice.customerName, // 4 Customer name (M)
    invoice.customerAddress, // 5 Address 1
    "", // 6 Address 2
    invoice.customerPostCode, // 7 Postal code (M)
    invoice.customerPostCity, // 8 City (M)
    invoice.customerCountry, // 9 Country
    invoice.customerPhone, // 10 Customer phone (M)
    "", // 11 Customer Fax
    invoice.customerEmail, // 12 Customer Email
    formatExportDate(invoice.createdAt, "ddMMyyyy"), // 13 Invoice Date (M)
    "", // 14 Credit Invoice
    invoice.invoiceNumber, // 15 Invoice number (M)
    "", // 16 KID/ODCR
    "", // 17 Currency
    "", // 18 Exchange Rate
    DateTime.fromISO(invoice.dueDate).toFormat("ddMMyyyy"), // 19 Invoice due date (M)
    dobOrOrganizationNumber, // 20 Customer organisation no
    inOre(invoice.totalGross), // 21 Invoice gross amount (M)
    inOre(invoice.totalNet), // 22 Invoice net amount (M)
    inOre(invoice.totalVat), // 23 VAT (M)
    invoice.totalGross >= 0 ? "IN" : "CR", // 24 Document Type (M): IN = invoice, CR = credit note
    "", // 25 Order number
    "", // 26 Project Number
    "", // 27 Department/Dimension
    nonEmpty(invoice.branchName) ?? invoice.ourReference, // 28 Our reference
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
    invoice.customerName, // 39 Delivery address name
    invoice.customerAddress, // 40 Delivery address 1
    "", // 41 Delivery address 2
    invoice.customerPostCode, // 42 Delivery address Postal code
    invoice.customerPostCity, // 43 Delivery address city
    invoice.customerCountry, // 44 Delivery address country
    "", // 45 Rating Date
    "", // 46 Rating poeng
    "", // 47 Client ID
    invoice.customerEmail, // 48 Delivery address Email
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
    ehf ? invoice.customerOrganizationNumber : "", // 63 eInvoice Reference: the org number for EHF
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

function vismaL1(lineNumber: number, invoiceNumber: string, line: InvoiceLine): CsvCell[] {
  return [
    "L1", // 1 Record type
    lineNumber, // 2 Line number
    invoiceNumber, // 3 Invoice number
    "V", // 4 Line type (M)
    line.vat <= 0 ? "FRI" : "PLH", // 5 VAT type (M)
    line.itemId ? String(objectIdCounter(line.itemId)) : line.productNumber, // 6 Article number
    line.title, // 7 Article name (M)
    line.numberOfItems, // 8 Invoiced quantity (M)
    line.discount, // 9 Discount %
    "", // 10 Currency
    inOre(line.gross), // 11 Gross amount (M)
    inOre(line.unit), // 12 Price per unit without VAT
    inOre(line.net), // 13 Net amount (M)
    inOre(line.vat), // 14 VAT amount (M)
    ...L1_TRAILING_FIELDS,
  ];
}

function vismaL1Fee(lineNumber: number, invoice: Invoice): CsvCell[] {
  const { feeGross, feeUnit, feeNet, feeVat } = invoice;
  if (feeGross === null || feeUnit === null || feeNet === null || feeVat === null) {
    throw new Error("fee line requested for an invoice without a fee");
  }
  return [
    "L1", // 1 Record type
    lineNumber, // 2 Line number
    invoice.invoiceNumber, // 3 Invoice number
    "V", // 4 Line type (M)
    "PLH", // 5 VAT type (M)
    FEE_ARTICLE_NUMBER, // 6 Article number
    FEE_TITLE, // 7 Article name (M)
    invoice.lines.length, // 8 Invoiced quantity (M)
    invoice.totalDiscount, // 9 Discount %
    "", // 10 Currency
    inOre(feeGross), // 11 Gross amount (M)
    inOre(feeUnit), // 12 Price per unit without VAT
    inOre(feeNet), // 13 Net amount (M)
    inOre(feeVat), // 14 VAT amount (M)
    ...L1_TRAILING_FIELDS,
  ];
}

function vismaL1Text(lineNumber: number, invoiceNumber: string, text: string): CsvCell[] {
  return [
    "L1", // 1 Record type
    lineNumber, // 2 Line number
    invoiceNumber, // 3 Invoice number
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

const TRIPLETEX_HEADERS = [
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
  /** The last order that set each customer item's period, by customer item id. */
  lastOrderIds: Map<string, string>;
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
    const invoiceDate = formatExportDate(invoice.createdAt, "yyyy-MM-dd");
    const dueDate = invoice.dueDate;
    const customerFields = [
      invoice.customerNumber,
      invoice.customerName,
      "",
      invoice.customerEmail,
      invoice.customerPhone,
      "",
      invoice.customerAddress,
      "",
      invoice.customerPostCode,
      invoice.customerPostCity,
      "NO",
      ...TRIPLETEX_EMPTY_CATEGORY_FIELDS,
      invoice.reference,
      "",
      "",
      "",
      "",
    ];
    let isFirstItem = true;
    for (const line of invoice.lines) {
      const customerItem = required(lookups.customerItems, line.customerItemId, "Kundeboka");
      const item = required(lookups.items, customerItem.itemId, "Boka");
      const handoutBranch = required(lookups.branches, customerItem.handoutBranchId, "Filialen");
      const orderDate = formatExportDate(customerItem.createdAt, "yyyy-MM-dd");
      rows.push([
        invoice.invoiceNumber,
        invoiceDate,
        dueDate,
        "",
        "",
        "",
        lookups.lastOrderIds.get(customerItem.id),
        orderDate,
        ...customerFields,
        isFirstItem
          ? `Faktura gjelder manglende betaling av andre avdrag ved ${handoutBranch.name}. Ved henvendelser om denne faktura, send mail til info@boklisten.no`
          : "",
        "NOK",
        orderDate,
        handoutBranch.name,
        handoutBranch.address ?? "",
        // Branches have no postal code or city; these were always empty.
        "",
        "",
        "",
        "",
        "",
        item.isbn === null ? "" : String(item.isbn),
        item.title,
        "",
        // Legacy bl-admin exported the stored amount, which is 0 for books moved between orders.
        String(customerItem.amountLeftToPay),
        "1",
        "0",
        "5",
      ]);
      isFirstItem = false;
    }
    rows.push([
      invoice.invoiceNumber,
      invoiceDate,
      dueDate,
      "",
      "",
      "",
      invoice.invoiceNumber,
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
      String(invoice.feeUnit),
      String(invoice.lines.length),
      String(invoice.totalDiscount),
      "3",
    ]);
  }
  return rows;
}
