import * as Sentry from "@sentry/node";
import { DateTime } from "luxon";

import CustomerItem from "#models/customer_item";
import type Order from "#models/order";
import type OrderItem from "#models/order_item";
import User from "#models/user";
import { OrderToCustomerItemGenerator } from "#services/customer_items/order_to_customer_item_generator";
import type { MonitoredEmployee } from "#services/employee_monitoring_service";
import { MatchRepository } from "#services/matches/match_repository";
import { OrderPlacedHandler } from "#services/orders/order_placed_handler";
import { OrderPayments } from "#services/payments/order_payments";
import { findSignatureException } from "#services/signature_helper";
import { standCustomerId } from "#services/stand_cart/stand_cart_payment";
import {
  derivePlacementReports,
  isLoanHandout,
  StandCartMonitoring,
} from "#services/stand_cart/stand_cart_monitoring";
import type { PlacementReport } from "#services/stand_cart/stand_cart_monitoring";

function isTakenBack(orderItem: OrderItem): boolean {
  return orderItem.type === "return" || orderItem.type === "buyback";
}

/** The held books the order acts on, as they are before the placement changes them. */
async function loadHeldBooks(order: Order): Promise<Map<string, CustomerItem>> {
  const customerItems = await CustomerItem.findByIds(
    order.orderItems.map((orderItem) => orderItem.customerItemId),
  );
  return new Map(customerItems.map((customerItem) => [customerItem.id, customerItem]));
}

async function collectReports(
  order: Order,
  customerId: string,
  heldBooks: Map<string, CustomerItem>,
  now: Date,
): Promise<PlacementReport[]> {
  const signatureException = order.orderItems.some(isLoanHandout)
    ? await findSignatureException(await User.findOrFail(customerId))
    : null;
  return derivePlacementReports({
    order,
    customerItemsBefore: heldBooks,
    payments: await OrderPayments.of(order.id),
    signatureException,
    now,
  });
}

/**
 * Every loan handed out becomes a customer item, and the order item learns its id, the same way
 * the legacy place operation did it. Buys and changes create nothing.
 */
async function createCustomerItems(order: Order): Promise<void> {
  const loans = order.orderItems.filter(isLoanHandout);
  const created = await new OrderToCustomerItemGenerator().createFor(order, loans);
  if (created.length !== loans.length) {
    throw new Error(`generated ${created.length} customer items for ${loans.length} loans`);
  }
  if (loans.length > 0) {
    await order.saveWithItems();
  }
}

/**
 * The stand is a party to every movement: copies handed out settle the customer's receiver half
 * of a match, copies taken back settle their sender half.
 */
async function recordHandovers(
  order: Order,
  customerId: string,
  heldBooks: Map<string, CustomerItem>,
  occurredAt: DateTime,
): Promise<void> {
  for (const orderItem of order.orderItems) {
    if (orderItem.handout && orderItem.blid) {
      const obligation = await MatchRepository.findReceiverObligation(customerId, orderItem.itemId);
      await MatchRepository.recordHandover({
        blid: orderItem.blid,
        itemId: orderItem.itemId,
        fromUserDetailId: null,
        toUserDetailId: customerId,
        occurredAt,
        orderId: order.id,
        dischargesSenderObligationId: null,
        dischargesReceiverObligationId: obligation?.id ?? null,
      });
    }
  }
  for (const orderItem of order.orderItems.filter(isTakenBack)) {
    const customerItem = heldBooks.get(orderItem.customerItemId ?? "");
    if (!customerItem?.customerId) {
      continue;
    }
    const obligation = await MatchRepository.findSenderObligation(
      customerItem.customerId,
      customerItem.itemId,
    );
    await MatchRepository.recordHandover({
      blid: customerItem.blid,
      itemId: customerItem.itemId,
      fromUserDetailId: customerItem.customerId,
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
    const customerId = standCustomerId(order);
    const heldBooks = await loadHeldBooks(order);
    const reports = await collectReports(order, customerId, heldBooks, now);
    await createCustomerItems(order);
    // The handler records who took returned books back, so it is told the employee, not the customer
    const placed = await new OrderPlacedHandler().placeOrder(order, employee.detailsId);

    await afterPlacement(() =>
      recordHandovers(placed, customerId, heldBooks, DateTime.fromJSDate(now)),
    );
    await afterPlacement(() => StandCartMonitoring.send(reports, employee, customerId));
    return placed;
  },
};
