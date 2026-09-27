import * as Sentry from "@sentry/node";

import BadRequestException from "#exceptions/bad_request_exception";
import CustomerItem from "#models/customer_item";
import Invoice from "#models/invoice";
import Order from "#models/order";
import type { NewOrderItem } from "#models/order";
import { OrderPlacedHandler } from "#services/orders/order_placed_handler";
import { invoiceDto } from "#services/invoices/invoice_query_service";
import { invoiceStatus, invoiceStatusFlags } from "#shared/invoice";
import type {
  Invoice as InvoiceDto,
  InvoiceBulkStatusChangeResult,
  InvoiceStatus,
  InvoiceStatusChangeResult,
} from "#shared/invoice";

/**
 * The amount legacy bl-admin put on an "invoice-paid" order line: the invoiced net amount, rounded to
 * whole kroner and then truncated to a multiple of ten, as its price service did for every order
 * line.
 */
export function invoicePaidLineAmount(net: number): number {
  const wholeKroner = Number(net.toFixed(0));
  return Math.trunc(wholeKroner / 10) * 10;
}

async function customerItemsOf(invoice: Invoice): Promise<CustomerItem[]> {
  return CustomerItem.findByIds(invoice.lines.map((line) => line.customerItemId));
}

/**
 * Marks the invoiced books as bought out. Legacy bl-admin recorded the payment of an invoice as an
 * "invoice-paid" order on the customer, so the books show up as paid for in the order history,
 * and set buyout on every invoiced customer item.
 */
async function recordPayment(invoice: Invoice, employeeDetailsId: string): Promise<string[]> {
  const warnings: string[] = [];
  const customerItems = await customerItemsOf(invoice);
  const unreturned = customerItems.filter((customerItem) => !customerItem.returned);
  const orderItems: NewOrderItem[] = invoice.lines.flatMap((line) => {
    const customerItem = unreturned.find((candidate) => candidate.id === line.customerItemId);
    if (!customerItem) {
      return [];
    }
    const amount = invoicePaidLineAmount(line.net);
    return [
      {
        type: "invoice-paid",
        itemId: customerItem.itemId,
        blid: customerItem.blid,
        amount,
        unitPrice: amount,
        handout: true,
        delivered: true,
        customerItemId: customerItem.id,
      },
    ];
  });

  const customer = unreturned[0]?.customerId ?? undefined;
  const branch = invoice.branchId ?? unreturned[0]?.handoutBranchId;
  if (orderItems.length === 0 || customer === undefined || branch === undefined) {
    warnings.push(
      "Ingen ordre ble registrert på kunden, siden ingen av bøkene på fakturaen er aktive.",
    );
  } else {
    try {
      const order = await Order.createWithItems({
        amount: orderItems.reduce((sum, orderItem) => sum + orderItem.amount, 0),
        orderItems,
        branchId: branch,
        customerId: customer,
        byCustomer: false,
        employeeId: employeeDetailsId,
        placed: false,
        notifyByEmail: false,
      });
      await new OrderPlacedHandler().placeOrder(order, employeeDetailsId);
    } catch (error) {
      Sentry.captureException(error);
      warnings.push(
        "Klarte ikke registrere ordren på kunden. Ordrehistorikken viser ikke betalingen.",
      );
    }
  }

  for (const customerItem of customerItems) {
    await customerItem.merge({ buyout: true }).save();
  }
  return warnings;
}

/** Undoes {@link recordPayment}: removes the invoice-paid order and clears buyout. */
async function revertPayment(invoice: Invoice): Promise<string[]> {
  const warnings: string[] = [];
  const invoiceItemIds = new Set(invoice.lines.map((line) => line.itemId));

  const orders = invoice.customerId ? await Order.placedFor(invoice.customerId) : [];
  const invoiceOrder = orders.find(
    (order) =>
      order.orderItems.some((orderItem) => orderItem.type === "invoice-paid") &&
      order.orderItems.every((orderItem) => invoiceItemIds.has(orderItem.itemId)),
  );
  if (invoiceOrder) {
    await invoiceOrder.delete();
  } else {
    warnings.push("Fant ingen ordre for betalingen å fjerne fra kunden.");
  }

  for (const customerItem of await customerItemsOf(invoice)) {
    await customerItem.merge({ buyout: false }).save();
  }
  return warnings;
}

export async function setInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus,
  employeeDetailsId: string,
): Promise<InvoiceStatusChangeResult> {
  const invoice = await Invoice.getOrFail(invoiceId);
  const previousStatus = invoiceStatus(invoice);
  await invoice.merge(invoiceStatusFlags(status)).save();

  let warnings: string[] = [];
  if (status === "paid" && previousStatus !== "paid") {
    warnings = await recordPayment(invoice, employeeDetailsId);
  } else if (status !== "paid" && previousStatus === "paid") {
    warnings = await revertPayment(invoice);
  }
  return { invoice: await invoiceDto(invoice), warnings };
}

/**
 * Changes several invoices one after the other, so each one's side effects run as they would
 * for a single change. Warnings are prefixed with the invoice number so the admin can tell
 * which invoice needs a look.
 */
export async function setInvoiceStatuses(
  invoiceIds: string[],
  status: InvoiceStatus,
  employeeDetailsId: string,
): Promise<InvoiceBulkStatusChangeResult> {
  const invoices: InvoiceDto[] = [];
  const warnings: string[] = [];
  for (const invoiceId of invoiceIds) {
    const result = await setInvoiceStatus(invoiceId, status, employeeDetailsId);
    invoices.push(result.invoice);
    warnings.push(
      ...result.warnings.map((warning) => `${result.invoice.invoiceNumber}: ${warning}`),
    );
  }
  return { invoices, warnings };
}

export async function setInvoiceLineCancelled(
  invoiceId: string,
  position: number,
  cancel: boolean,
): Promise<InvoiceDto> {
  const invoice = await Invoice.getOrFail(invoiceId);
  const line = invoice.lines.find((candidate) => candidate.position === position);
  if (line === undefined) {
    throw new BadRequestException("Fakturalinjen finnes ikke.");
  }
  await line.merge({ cancel }).save();
  return invoiceDto(invoice);
}

/**
 * Removes an invoice for good. Only an invoice nobody has acted on yet may go: a paid one has an
 * order and bought-out books behind it, and a credit note, debt collection or loss note is
 * bookkeeping the accountants rely on.
 */
export async function deleteInvoice(invoiceId: string): Promise<void> {
  const invoice = await Invoice.getOrFail(invoiceId);
  if (invoiceStatus(invoice) !== "unpaid") {
    throw new BadRequestException("Bare ubetalte fakturaer kan slettes.");
  }
  await invoice.delete();
}
