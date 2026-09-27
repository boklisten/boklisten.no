import BranchModel from "#models/branch";
import CustomerItem from "#models/customer_item";
import ItemModel from "#models/item";
import BadRequestException from "#exceptions/bad_request_exception";
import User from "#models/user";
import { StorageService } from "#services/storage_service";
import type { Branch } from "#shared/branch";
import type {
  Invoice,
  InvoiceCustomerItemPayment,
  InvoiceGenerationResult,
  InvoiceGenerationSettings,
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

type LinePayment = InvoiceCustomerItemPayment["payment"];

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
function assertFiniteAmounts(invoice: Invoice) {
  const payments = [
    ...invoice.customerItemPayments.map((line) => ({ label: line.title, payment: line.payment })),
    { label: "gebyr", payment: invoice.payment.fee },
    { label: "total", payment: invoice.payment.total },
  ];
  const invalid = payments
    .map(({ label, payment }) => ({
      label,
      fields: Object.entries(payment ?? {})
        .filter(([, value]) => !Number.isFinite(value))
        .map(([field]) => field),
    }))
    .filter(({ fields }) => fields.length > 0);
  if (invalid.length > 0) {
    throw new BadRequestException(
      `Faktura ${invoice.invoiceId} til ${invoice.customerInfo.name} har ugyldige beløp: ${invalid
        .map(({ label, fields }) => `${label} (${fields.join(", ")})`)
        .join(", ")}`,
    );
  }
}

function buildInvoice(
  { customer, customerItems }: CustomerBooks,
  invoiceNumber: number,
  duedate: Date,
  settings: InvoiceGenerationSettings,
  { items, branches, lastPeriodTypes }: Lookups,
): Omit<Invoice, "id"> {
  const lines: InvoiceCustomerItemPayment[] = [];
  for (const customerItem of customerItems) {
    const item = items.get(customerItem.itemId);
    if (!item) {
      throw new BadRequestException(`Boka ${customerItem.itemId} finnes ikke.`);
    }
    const branch = branches.get(customerItem.handoutBranchId);
    lines.push({
      customerItem: customerItem.id,
      customerItemType: customerItem.type,
      title: item.title,
      item: item.id,
      numberOfItems: 1,
      payment: linePayment(customerItem, item, branch, settings, lastPeriodTypes),
    });
  }

  const fee = feePayment(lines.length, settings);
  const total = {
    gross: lines.reduce((sum, line) => sum + line.payment.gross, 0) + fee.gross,
    net: lines.reduce((sum, line) => sum + line.payment.net, 0) + fee.net,
    vat: lines.reduce((sum, line) => sum + line.payment.vat, 0) + fee.vat,
    discount: 0,
  };
  const invoice: Omit<Invoice, "id"> = {
    duedate,
    customerHavePayed: false,
    toCreditNote: false,
    toDebtCollection: false,
    toLossNote: false,
    branch: customerItems[0]?.handoutBranchId,
    type: settings.type,
    customerItemPayments: lines,
    customerInfo: {
      userDetail: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone ?? "",
      dob: customer.dob?.toJSDate(),
      postal: {
        address: customer.address,
        city: customer.postCity,
        code: customer.postCode,
      },
    },
    payment: { total, fee, totalIncludingFee: total.gross },
    reference: settings.reference,
    invoiceId: String(invoiceNumber),
  };
  assertFiniteAmounts({ ...invoice, id: "" });
  return invoice;
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
  const duedate = new Date(Date.now() + settings.daysToDeadline * DAY_MS);
  let invoiceNumber = settings.invoiceNumber;
  const invoices: Invoice[] = [];
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
      duedate,
      settings,
      lookups,
    );
    invoiceNumber++;
    invoices.push(dryRun ? { ...invoice, id: "" } : await StorageService.Invoices.add(invoice));
  }
  return { invoices, skipped };
}
