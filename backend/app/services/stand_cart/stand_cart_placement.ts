import * as Sentry from "@sentry/node";
import { DateTime } from "luxon";

import { OrderToCustomerItemGenerator } from "#services/customer_items/order_to_customer_item_generator";
import type { MonitoredEmployee } from "#services/employee_monitoring_service";
import { MatchRepository } from "#services/matches/match_repository";
import { OrderPlacedHandler } from "#services/orders/order_placed_handler";
import { findSignatureException } from "#services/signature_helper";
import {
  customerItemIdOf,
  derivePlacementReports,
  isLoanHandout,
  StandCartMonitoring,
} from "#services/stand_cart/stand_cart_monitoring";
import type { PlacementReport } from "#services/stand_cart/stand_cart_monitoring";
import { StorageService } from "#services/storage_service";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Order } from "#shared/order/order";
import type { OrderItem } from "#shared/order/order-item/order-item";
import type { Payment } from "#shared/payment/payment";
import { USER_PERMISSION } from "#shared/user-permission";

function isTakenBack(orderItem: OrderItem): boolean {
  return orderItem.type === "return" || orderItem.type === "buyback";
}

/** The held books the order acts on, as they are before the placement changes them. */
async function loadHeldBooks(order: Order): Promise<Map<string, CustomerItem>> {
  const ids = [...new Set(order.orderItems.map(customerItemIdOf))].filter(
    (id): id is string => id !== undefined,
  );
  const customerItems =
    ids.length === 0 ? [] : await StorageService.CustomerItems.getMany(ids, USER_PERMISSION.ADMIN);
  return new Map(customerItems.map((customerItem) => [customerItem.id, customerItem]));
}

async function loadPayments(order: Order): Promise<Payment[]> {
  return order.payments.length === 0
    ? []
    : StorageService.Payments.getMany(order.payments, USER_PERMISSION.ADMIN);
}

async function collectReports(
  order: Order,
  heldBooks: Map<string, CustomerItem>,
  now: Date,
): Promise<PlacementReport[]> {
  const signatureException = order.orderItems.some(isLoanHandout)
    ? await findSignatureException(await StorageService.UserDetails.get(order.customer))
    : null;
  return derivePlacementReports({
    order,
    customerItemsBefore: heldBooks,
    payments: await loadPayments(order),
    signatureException,
    now,
  });
}

/**
 * Every loan handed out becomes a customer item, and the order item learns its id, the same way
 * the legacy place operation did it. Buys and changes create nothing.
 */
async function createCustomerItems(
  order: Order,
): Promise<{ order: Order; created: CustomerItem[] }> {
  const generator = new OrderToCustomerItemGenerator();
  const created: CustomerItem[] = [];
  const orderItems: OrderItem[] = [];
  for (const orderItem of order.orderItems) {
    if (!isLoanHandout(orderItem)) {
      orderItems.push(orderItem);
      continue;
    }
    const [generated] = await generator.generate({ ...order, orderItems: [orderItem] });
    if (!generated) {
      throw new Error(`no customer item generated for ${orderItem.title}`);
    }
    const customerItem = await StorageService.CustomerItems.add(generated);
    created.push(customerItem);
    orderItems.push({ ...orderItem, customerItem: customerItem.id });
  }
  if (created.length === 0) {
    return { order, created };
  }
  return { order: await StorageService.Orders.update(order.id, { orderItems }), created };
}

async function attachToCustomer(customerId: string, created: CustomerItem[]): Promise<void> {
  if (created.length === 0) {
    return;
  }
  const customer = await StorageService.UserDetails.get(customerId);
  await StorageService.UserDetails.update(customerId, {
    customerItems: [...customer.customerItems, ...created.map((customerItem) => customerItem.id)],
  });
}

/**
 * The stand is a party to every movement: copies handed out settle the customer's receiver half
 * of a match, copies taken back settle their sender half.
 */
async function recordHandovers(
  order: Order,
  heldBooks: Map<string, CustomerItem>,
  occurredAt: DateTime,
): Promise<void> {
  for (const orderItem of order.orderItems) {
    if (orderItem.handout && orderItem.blid) {
      const obligation = await MatchRepository.findReceiverObligation(
        order.customer,
        orderItem.item,
      );
      await MatchRepository.recordHandover({
        blid: orderItem.blid,
        itemId: orderItem.item,
        fromUserDetailId: null,
        toUserDetailId: order.customer,
        occurredAt,
        orderId: order.id,
        dischargesSenderObligationId: null,
        dischargesReceiverObligationId: obligation?.id ?? null,
      });
    }
  }
  for (const orderItem of order.orderItems.filter(isTakenBack)) {
    const customerItem = heldBooks.get(customerItemIdOf(orderItem) ?? "");
    if (!customerItem) {
      continue;
    }
    const obligation = await MatchRepository.findSenderObligation(
      customerItem.customer,
      customerItem.item,
    );
    await MatchRepository.recordHandover({
      blid: customerItem.blid ?? null,
      itemId: customerItem.item,
      fromUserDetailId: customerItem.customer,
      toUserDetailId: null,
      occurredAt,
      orderId: order.id,
      dischargesSenderObligationId: obligation?.id ?? null,
      dischargesReceiverObligationId: null,
    });
  }
}

/** Bookkeeping after a placed order: a failure is reported, never allowed to undo the placement. */
async function afterPlacement(task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (error) {
    Sentry.captureException(error);
  }
}

export const StandCartPlacement = {
  /**
   * Turns a stored stand order into a placed one: customer items for the loans handed out, the
   * placed-order handler (payments, customer item effects, moved-from links, receipt), then the
   * handover rows and the reports to the administrator. Works from the order alone, so a Vipps
   * order can be settled long after the checkout request that created it.
   */
  async place(order: Order, employee: MonitoredEmployee, now = new Date()): Promise<Order> {
    const heldBooks = await loadHeldBooks(order);
    const reports = await collectReports(order, heldBooks, now);
    const { order: withCustomerItems, created } = await createCustomerItems(order);
    // The handler records who took returned books back, so it is told the employee, not the customer
    const placed = await new OrderPlacedHandler().placeOrder(withCustomerItems, employee.detailsId);

    await afterPlacement(() => attachToCustomer(order.customer, created));
    await afterPlacement(() => recordHandovers(placed, heldBooks, DateTime.fromJSDate(now)));
    await afterPlacement(() => StandCartMonitoring.send(reports, employee, order.customer));
    return placed;
  },
};
