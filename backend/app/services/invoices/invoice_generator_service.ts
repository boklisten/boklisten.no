import BadRequestException from "#exceptions/bad_request_exception";
import { StorageService } from "#services/storage_service";
import { isNotNullish } from "#services/typescript_helpers";
import type { Branch } from "#shared/branch";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type {
  Invoice,
  InvoiceCustomerItemPayment,
  InvoiceGenerationResult,
  InvoiceGenerationSettings,
} from "#shared/invoice";
import type { Item } from "#shared/item";
import type { Order } from "#shared/order/order";
import type { UserDetail } from "#shared/user-detail";

/**
 * Generates invoices for books that were neither returned nor bought out by their deadline, one
 * invoice per customer, the way bl-admin's InvoiceGeneratorService did. The amounts are computed
 * with the same arithmetic so the invoices come out the same.
 */

/** bl-admin's price service rounded every amount to whole kroner. */
function wholeKroner(amount: number): number {
  return Number(amount.toFixed(0));
}

const DAY_MS = 24 * 60 * 60 * 1000;

type LinePayment = InvoiceCustomerItemPayment["payment"];

interface CustomerBooks {
  customer: UserDetail;
  customerItems: CustomerItem[];
}

async function unreturnedCustomerItems(
  settings: InvoiceGenerationSettings,
): Promise<CustomerItem[]> {
  return StorageService.CustomerItems.aggregate<CustomerItem>([
    {
      $match: {
        returned: false,
        buyout: false,
        type: settings.type,
        deadline: { $gte: settings.deadlineFrom, $lte: settings.deadlineTo },
        "handoutInfo.handoutById": { $exists: true },
      },
    },
    { $sort: { deadline: 1, _id: 1 } },
  ]);
}

/** Groups by customer in order of first appearance, which decides the invoice numbers. */
function groupByCustomer(customerItems: CustomerItem[]): Map<string, CustomerItem[]> {
  const groups = new Map<string, CustomerItem[]>();
  for (const customerItem of customerItems) {
    const group = groups.get(customerItem.customer) ?? [];
    group.push(customerItem);
    groups.set(customerItem.customer, group);
  }
  return groups;
}

/** Everything the amounts are computed from, fetched up front so no book costs a round-trip. */
interface Lookups {
  items: Map<string, Item>;
  branches: Map<string, Branch>;
  /** The last order of each partly-payment book without a stored amount, by order id. */
  lastOrders: Map<string, Order>;
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
  lastOrders: Map<string, Order>,
): number {
  if (customerItem.amountLeftToPay) {
    return customerItem.amountLeftToPay;
  }
  const lastOrderId = customerItem.orders.at(-1);
  const lastOrder = lastOrderId ? lastOrders.get(lastOrderId) : undefined;
  const orderItem = lastOrder?.orderItems.find(
    (candidate) => candidate.customerItem === customerItem.id,
  );
  const buyoutPercentage =
    branch?.paymentInfo?.partlyPaymentPeriods?.find(
      (period) => period.type === orderItem?.info?.periodType,
    )?.percentageBuyout ?? branch?.paymentInfo?.buyout?.percentage;
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
  lastOrders: Map<string, Order>,
): LinePayment {
  if (customerItem.type === "partly-payment") {
    const amountLeft = partlyPaymentAmountLeft(customerItem, item, branch, lastOrders);
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
  { items, branches, lastOrders }: Lookups,
): Omit<Invoice, "id"> {
  const lines: InvoiceCustomerItemPayment[] = [];
  for (const customerItem of customerItems) {
    const item = items.get(customerItem.item);
    if (!item) {
      throw new BadRequestException(`Boka ${customerItem.item} finnes ikke.`);
    }
    const branch = customerItem.handoutInfo
      ? branches.get(customerItem.handoutInfo.handoutById)
      : undefined;
    lines.push({
      customerItem: customerItem.id,
      customerItemType: customerItem.type,
      title: item.title,
      item: item.id,
      numberOfItems: 1,
      payment: linePayment(customerItem, item, branch, settings, lastOrders),
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
    branch: customerItems[0]?.handoutInfo?.handoutById,
    type: settings.type,
    customerItemPayments: lines,
    customerInfo: {
      userDetail: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      dob: customer.dob,
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

  const [customers, items, branches, lastOrders] = await Promise.all([
    StorageService.UserDetails.getMany([...groups.keys()], "admin"),
    StorageService.Items.getMany(
      [...new Set(customerItems.map((customerItem) => customerItem.item))],
      "admin",
    ),
    StorageService.Branches.getMany(
      [
        ...new Set(
          customerItems
            .map((customerItem) => customerItem.handoutInfo?.handoutById)
            .filter(isNotNullish),
        ),
      ],
      "admin",
    ),
    StorageService.Orders.getMany(
      [
        ...new Set(
          customerItems
            .filter((customerItem) => needsLastOrder(customerItem))
            .map((customerItem) => customerItem.orders.at(-1))
            .filter(isNotNullish),
        ),
      ],
      "admin",
    ),
  ]);
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  const lookups: Lookups = {
    items: new Map(items.map((item) => [item.id, item])),
    branches: new Map(branches.map((branch) => [branch.id, branch])),
    lastOrders: new Map(lastOrders.map((order) => [order.id, order])),
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
          reason: `Kunden ${customerId} finnes ikke lenger.`,
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
