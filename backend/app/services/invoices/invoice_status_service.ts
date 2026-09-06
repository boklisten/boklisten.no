import * as Sentry from "@sentry/node";

import BadRequestException from "#exceptions/bad_request_exception";
import { SEDbQuery } from "#models/mongoose/storage/db-query";
import { OrderPlacedHandler } from "#services/orders/order_placed_handler";
import { StorageService } from "#services/storage_service";
import { isNotNullish } from "#services/typescript_helpers";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import { invoiceStatus, invoiceStatusFlags } from "#shared/invoice";
import type { Invoice, InvoiceStatus, InvoiceStatusChangeResult } from "#shared/invoice";
import type { OrderItem } from "#shared/order/order-item/order-item";

/**
 * The amount bl-admin put on an "invoice-paid" order line: the invoiced net amount, rounded to
 * whole kroner and then truncated to a multiple of ten, as its price service did for every order
 * line.
 */
export function invoicePaidLineAmount(net: number): number {
  const wholeKroner = Number(net.toFixed(0));
  return Math.trunc(wholeKroner / 10) * 10;
}

async function customerItemsOf(invoice: Invoice): Promise<CustomerItem[]> {
  const ids = invoice.customerItemPayments
    .map((payment) => payment.customerItem)
    .filter(isNotNullish);
  return ids.length === 0 ? [] : StorageService.CustomerItems.getMany(ids, "admin");
}

/**
 * Marks the invoiced books as bought out. bl-admin recorded the payment of an invoice as an
 * "invoice-paid" order on the customer, so the books show up as paid for in the order history,
 * and set buyout on every invoiced customer item.
 */
async function recordPayment(invoice: Invoice, employeeDetailsId: string): Promise<string[]> {
  const warnings: string[] = [];
  const customerItems = await customerItemsOf(invoice);
  const unreturned = customerItems.filter((customerItem) => !customerItem.returned);
  const orderItems: OrderItem[] = invoice.customerItemPayments.flatMap((payment) => {
    const customerItem = unreturned.find((candidate) => candidate.id === payment.customerItem);
    if (!customerItem) {
      return [];
    }
    const amount = invoicePaidLineAmount(payment.payment.net);
    return [
      {
        type: "invoice-paid",
        item: customerItem.item,
        title: payment.title,
        blid: customerItem.blid,
        amount,
        unitPrice: amount,
        handout: true,
        info: { customerItem: customerItem.id },
        delivered: true,
        customerItem: customerItem.id,
      },
    ];
  });

  const customer = unreturned[0]?.customer;
  const branch = invoice.branch ?? unreturned[0]?.handoutInfo?.handoutById;
  if (orderItems.length === 0 || customer === undefined || branch === undefined) {
    warnings.push(
      "Ingen ordre ble registrert på kunden, siden ingen av bøkene på fakturaen er aktive.",
    );
  } else {
    try {
      const order = await StorageService.Orders.add({
        amount: orderItems.reduce((sum, orderItem) => sum + orderItem.amount, 0),
        orderItems,
        branch,
        customer,
        byCustomer: false,
        employee: employeeDetailsId,
        placed: false,
        payments: [],
        handoutByDelivery: false,
        notification: { email: false },
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
    await StorageService.CustomerItems.update(customerItem.id, { buyout: true });
  }
  return warnings;
}

/** Undoes {@link recordPayment}: removes the invoice-paid order and clears buyout. */
async function revertPayment(invoice: Invoice): Promise<string[]> {
  const warnings: string[] = [];
  const customerDetailsId = invoice.customerInfo.userDetail;
  const invoiceItemIds = new Set(invoice.customerItemPayments.map((payment) => payment.item));

  const query = new SEDbQuery();
  query.objectIdFilters = [{ fieldName: "customer", value: customerDetailsId ?? "" }];
  query.booleanFilters = [{ fieldName: "placed", value: true }];
  const orders = customerDetailsId
    ? ((await StorageService.Orders.getByQueryOrNull(query)) ?? [])
    : [];
  const invoiceOrder = orders.find(
    (order) =>
      order.orderItems.some((orderItem) => orderItem.type === "invoice-paid") &&
      order.orderItems.every((orderItem) => invoiceItemIds.has(orderItem.item)),
  );
  if (invoiceOrder) {
    await StorageService.Orders.remove(invoiceOrder.id);
    if (customerDetailsId) {
      const userDetail = await StorageService.UserDetails.getOrNull(customerDetailsId);
      if (userDetail?.orders.includes(invoiceOrder.id)) {
        await StorageService.UserDetails.update(customerDetailsId, {
          orders: userDetail.orders.filter((orderId) => orderId !== invoiceOrder.id),
        });
      }
    }
  } else {
    warnings.push("Fant ingen ordre for betalingen å fjerne fra kunden.");
  }

  for (const customerItem of await customerItemsOf(invoice)) {
    await StorageService.CustomerItems.update(customerItem.id, { buyout: false });
  }
  return warnings;
}

export async function setInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus,
  employeeDetailsId: string,
): Promise<InvoiceStatusChangeResult> {
  const before = await StorageService.Invoices.get(invoiceId);
  const previousStatus = invoiceStatus(before);
  const invoice = await StorageService.Invoices.update(invoiceId, invoiceStatusFlags(status));

  let warnings: string[] = [];
  if (status === "paid" && previousStatus !== "paid") {
    warnings = await recordPayment(invoice, employeeDetailsId);
  } else if (status !== "paid" && previousStatus === "paid") {
    warnings = await revertPayment(invoice);
  }
  return { invoice, warnings };
}

export async function setInvoiceLineCancelled(
  invoiceId: string,
  lineIndex: number,
  cancel: boolean,
): Promise<Invoice> {
  const invoice = await StorageService.Invoices.get(invoiceId);
  const line = invoice.customerItemPayments[lineIndex];
  if (line === undefined) {
    throw new BadRequestException("Fakturalinjen finnes ikke.");
  }
  const customerItemPayments = [...invoice.customerItemPayments];
  customerItemPayments[lineIndex] = { ...line, cancel };
  return StorageService.Invoices.update(invoiceId, { customerItemPayments });
}
