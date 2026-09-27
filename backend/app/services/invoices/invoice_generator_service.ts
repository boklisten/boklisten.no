import { DateTime } from "luxon";

import BranchModel from "#models/branch";
import CustomerItem from "#models/customer_item";
import Invoice from "#models/invoice";
import type { NewInvoice, NewInvoiceLine } from "#models/invoice";
import ItemModel from "#models/item";
import BadRequestException from "#exceptions/bad_request_exception";
import User from "#models/user";
import type { Branch } from "#shared/branch";
import type {
  InvoiceGenerationResult,
  InvoiceGenerationSettings,
  InvoiceListRow,
} from "#shared/invoice";
import type { Item } from "#shared/item";
import type { Period } from "#shared/period";

/**
 * Generates invoices for books that were neither returned nor bought out by their deadline, one
 * invoice per customer, the way legacy bl-admin's InvoiceGeneratorService did. The amounts are computed
 * with the same arithmetic so the invoices come out the same.
 */

/** Legacy bl-admin's price service rounded every amount to whole kroner. */
function wholeKroner(amount: number): number {
  return Number(amount.toFixed(0));
}

const DAY_MS = 24 * 60 * 60 * 1000;

type LinePayment = Pick<NewInvoiceLine, "unit" | "gross" | "net" | "vat" | "discount">;

/**
 * The number the accounting systems know a pupil by, derived from their user id the way legacy
 * bl-admin did since 2023-01-25 (the pair's middle digits have the most entropy). It is stored on
 * the invoice, so it survives the customer.
 */
export function pupilCustomerNumber(userId: string): string {
  const epoch = new Date(Number.parseInt(userId.slice(0, 8), 16)).getTime();
  const increment = Number.parseInt(userId.slice(-6), 16);
  const pair = ((epoch + increment) * (epoch + increment + 1)) / 2 + increment;
  return String(Number(String(pair).slice(6, 14)));
}

interface CustomerBooks {
  customer: User;
  customerItems: CustomerItem[];
}

async function unreturnedCustomerItems(
  settings: InvoiceGenerationSettings,
): Promise<CustomerItem[]> {
  return CustomerItem.query()
    .where("returned", false)
    .where("buyout", false)
    .where("type", settings.type)
    .where("deadline", ">=", settings.deadlineFrom)
    .where("deadline", "<=", settings.deadlineTo)
    .orderBy("deadline")
    .orderBy("id");
}

/** Groups by customer in order of first appearance, which decides the invoice numbers. */
function groupByCustomer(customerItems: CustomerItem[]): Map<string, CustomerItem[]> {
  const groups = new Map<string, CustomerItem[]>();
  for (const customerItem of customerItems) {
    const customerId = customerItem.customerId ?? "";
    const group = groups.get(customerId) ?? [];
    group.push(customerItem);
    groups.set(customerId, group);
  }
  return groups;
}

/** Everything the amounts are computed from, fetched up front so no book costs a round-trip. */
interface Lookups {
  items: Map<string, Item>;
  branches: Map<string, Branch>;
  /**
   * The period type of the last order that set the period of each partly-payment book without a
   * stored amount, by customer item id.
   */
  lastPeriodTypes: Map<string, Period | null>;
}

function needsLastOrder(customerItem: CustomerItem): boolean {
  return customerItem.type === "partly-payment" && !customerItem.amountLeftToPay;
}

/**
 * The buyout amount of a partly-payment book. The stored amount is 0 for books moved between
 * orders, so it is recomputed from the price and the branch's buyout percentage when missing,
 * the way the buyout itself is.
 */
function partlyPaymentAmountLeft(
  customerItem: CustomerItem,
  item: Item,
  branch: Branch | undefined,
  lastPeriodTypes: Map<string, Period | null>,
): number {
  if (customerItem.amountLeftToPay) {
    return customerItem.amountLeftToPay;
  }
  const periodType = lastPeriodTypes.get(customerItem.id);
  const buyoutPercentage =
    branch?.partlyPaymentPeriods.find((period) => period.type === periodType)?.percentageBuyout ??
    branch?.buyoutPercentage;
  if (buyoutPercentage === undefined) {
    throw new BadRequestException(
      `Filialen som delte ut "${item.title}" har ingen utkjøpsprosent, så beløpet kan ikke regnes ut.`,
    );
  }
  return Math.floor((item.price * buyoutPercentage) / 10) * 10;
}

function linePayment(
  customerItem: CustomerItem,
  item: Item,
  branch: Branch | undefined,
  settings: InvoiceGenerationSettings,
  lastPeriodTypes: Map<string, Period | null>,
): LinePayment {
  if (customerItem.type === "partly-payment") {
    const amountLeft = partlyPaymentAmountLeft(customerItem, item, branch, lastPeriodTypes);
    return { unit: amountLeft, gross: amountLeft, net: amountLeft, vat: 0, discount: 0 };
  }
  // Books are VAT exempt in the last sales link, rented or sold (mval. § 6-4).
  const gross = wholeKroner(item.price * settings.feePercentage);
  return { unit: item.price, gross, net: gross, vat: 0, discount: 0 };
}

function feePayment(lineCount: number, settings: InvoiceGenerationSettings) {
  const net = wholeKroner(lineCount * settings.fee);
  const vat = wholeKroner(net * settings.feeVatPercentage);
  return { unit: settings.fee, net, vat, gross: net + vat, discount: 0 };
}

/**
 * An amount that is not a number would be stored as null and exported as 0, which silently
 * gives wrong invoices, so refuse to create the invoice instead.
 */
function assertFiniteAmounts(invoice: NewInvoice, fee: LinePayment) {
  const payments = [
    ...invoice.lines.map((line) => ({ label: line.title, payment: linePaymentOf(line) })),
    { label: "gebyr", payment: fee },
    {
      label: "total",
      payment: {
        gross: invoice.totalGross,
        net: invoice.totalNet,
        vat: invoice.totalVat,
        discount: invoice.totalDiscount,
      },
    },
  ];
  const invalid = payments
    .map(({ label, payment }) => ({
      label,
      fields: Object.entries(payment)
        .filter(([, value]) => !Number.isFinite(value))
        .map(([field]) => field),
    }))
    .filter(({ fields }) => fields.length > 0);
  if (invalid.length > 0) {
    throw new BadRequestException(
      `Faktura ${invoice.invoiceNumber} til ${invoice.customerName} har ugyldige beløp: ${invalid
        .map(({ label, fields }) => `${label} (${fields.join(", ")})`)
        .join(", ")}`,
    );
  }
}

function linePaymentOf({ unit, gross, net, vat, discount }: LinePayment): LinePayment {
  return { unit, gross, net, vat, discount };
}

function buildInvoice(
  { customer, customerItems }: CustomerBooks,
  invoiceNumber: number,
  dueDate: Date,
  settings: InvoiceGenerationSettings,
  { items, branches, lastPeriodTypes }: Lookups,
): NewInvoice {
  const lines: NewInvoiceLine[] = [];
  for (const customerItem of customerItems) {
    const item = items.get(customerItem.itemId);
    if (!item) {
      throw new BadRequestException(`Boka ${customerItem.itemId} finnes ikke.`);
    }
    const branch = branches.get(customerItem.handoutBranchId);
    lines.push({
      customerItemId: customerItem.id,
      customerItemType: customerItem.type,
      title: item.title,
      itemId: item.id,
      productNumber: null,
      numberOfItems: 1,
      ...linePayment(customerItem, item, branch, settings, lastPeriodTypes),
    });
  }

  const fee = feePayment(lines.length, settings);
  const totalGross = lines.reduce((sum, line) => sum + line.gross, 0) + fee.gross;
  const invoice: NewInvoice = {
    invoiceNumber: String(invoiceNumber),
    type: settings.type,
    dueDate: DateTime.fromJSDate(dueDate),
    branchId: customerItems[0]?.handoutBranchId ?? null,
    customerId: customer.id,
    customerNumber: pupilCustomerNumber(customer.id),
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone ?? "",
    customerDob: customer.dob,
    customerOrganizationNumber: null,
    customerAddress: customer.address,
    customerPostCode: customer.postCode,
    customerPostCity: customer.postCity,
    customerCountry: null,
    totalGross,
    totalNet: lines.reduce((sum, line) => sum + line.net, 0) + fee.net,
    totalVat: lines.reduce((sum, line) => sum + line.vat, 0) + fee.vat,
    totalDiscount: 0,
    feeUnit: fee.unit,
    feeGross: fee.gross,
    feeNet: fee.net,
    feeVat: fee.vat,
    feeDiscount: fee.discount,
    totalIncludingFee: totalGross,
    reference: settings.reference,
    ourReference: null,
    comment: null,
    lines,
  };
  assertFiniteAmounts(invoice, fee);
  return invoice;
}

function listRow(invoice: NewInvoice, id: string, createdAt: Date): InvoiceListRow {
  return {
    id,
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customerName,
    customerId: invoice.customerId,
    customerOrganizationNumber: null,
    type: invoice.type,
    createdAt,
    dueDate: invoice.dueDate.toJSDate(),
    totalIncludingFee: invoice.totalIncludingFee,
    status: "unpaid",
  };
}

export async function generateInvoices(
  settings: InvoiceGenerationSettings,
  dryRun: boolean,
): Promise<InvoiceGenerationResult> {
  const customerItems = await unreturnedCustomerItems(settings);
  const groups = groupByCustomer(customerItems);

  const [customers, items, branches, lastPeriodLines] = await Promise.all([
    User.findMany([...groups.keys()].filter((customerId) => customerId !== "")),
    ItemModel.findMany([...new Set(customerItems.map((customerItem) => customerItem.itemId))]),
    BranchModel.findMany([
      ...new Set(customerItems.map((customerItem) => customerItem.handoutBranchId)),
    ]),
    CustomerItem.lastPeriodLinesOf(
      customerItems
        .filter((customerItem) => needsLastOrder(customerItem))
        .map((customerItem) => customerItem.id),
    ),
  ]);
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  const lookups: Lookups = {
    items: new Map(items.map((item) => [item.id, item])),
    branches: new Map(branches.map((branch) => [branch.id, branch])),
    lastPeriodTypes: new Map(
      [...lastPeriodLines].map(([customerItemId, line]) => [customerItemId, line.periodType]),
    ),
  };

  const skipped: InvoiceGenerationResult["skipped"] = [];
  const dueDate = new Date(Date.now() + settings.daysToDeadline * DAY_MS);
  let invoiceNumber = settings.invoiceNumber;
  const invoices: InvoiceListRow[] = [];
  for (const [customerId, books] of groups) {
    const customer = customersById.get(customerId);
    if (!customer) {
      skipped.push(
        ...books.map((customerItem) => ({
          customerItemId: customerItem.id,
          reason: "Kunden finnes ikke lenger.",
        })),
      );
      continue;
    }
    const invoice = buildInvoice(
      { customer, customerItems: books },
      invoiceNumber,
      dueDate,
      settings,
      lookups,
    );
    invoiceNumber++;
    if (dryRun) {
      // Not saved, so the number stands in for the id; it is unique within the batch.
      invoices.push(listRow(invoice, invoice.invoiceNumber, new Date()));
    } else {
      const saved = await Invoice.createWithLines(invoice);
      invoices.push(listRow(invoice, saved.id, saved.createdAt.toJSDate()));
    }
  }
  return { invoices, skipped };
}
