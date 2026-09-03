import * as Sentry from "@sentry/node";
import logger from "@adonisjs/core/services/logger";

import BadRequestException from "#exceptions/bad_request_exception";
import {
  availableExtendPeriods,
  calculateBuyoutStatus,
  calculateExtensionStatus,
} from "#services/customer_item_actions_service";
import { OrderPlacedHandler } from "#services/legacy/collections/order/helpers/order-placed-handler/order-placed-handler";
import { DateService } from "#services/legacy/date.service";
import { OrderHistoryService } from "#services/order_history_service";
import { isSameDeadlineDay } from "#services/order_item_service";
import { OrderService } from "#services/order_service";
import { StorageService } from "#services/storage_service";
import { VippsPaymentService } from "#services/vipps/vipps_payment_service";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Order } from "#shared/order/order";
import type { OrderHistoryEntry } from "#shared/order/order-history";
import type { PaymentMethod } from "#shared/payment/payment-method/payment-method";

export type StandCheckoutAction = { type: "buyout" } | { type: "extend"; to: Date };
export type StandPayment = { method: "card" } | { method: "vipps"; phoneNumber: string };

/**
 * Where a stand order stands. Card orders are paid the moment they are created; Vipps orders are
 * pending until the customer answers the request on their phone.
 */
export type StandCheckoutStatus = "pending" | "paid" | "aborted" | "expired" | "cancelled";

export interface StandCheckoutState {
  orderId: string;
  status: StandCheckoutStatus;
  /** The receipt, once the order is placed. */
  order: OrderHistoryEntry | null;
}

/** The Vipps Checkout vocabulary is reused so one field tells the story for both flows. */
const CHECKOUT_STATE = {
  created: "SessionCreated",
  paid: "PaymentSuccessful",
  aborted: "PaymentTerminated",
  expired: "SessionExpired",
  cancelled: "PaymentCancelled",
} as const;

/** MSISDN as the ePayment API wants it: country code and subscriber number, digits only. */
export function toMsisdn(phoneNumber: string): string {
  const digits = phoneNumber.replaceAll(/[\s+]/g, "");
  const subscriber = /^(?:47)?(?<subscriber>\d{8})$/.exec(digits)?.groups?.["subscriber"];
  if (subscriber === undefined) {
    throw new BadRequestException("Telefonnummeret må være et norsk nummer med 8 siffer");
  }
  return `47${subscriber}`;
}

/**
 * Vipps answers a request for a number without an app user with error 7010, "Customer not found".
 * That is the one failure the employee can fix on the spot, so it gets a message of its own.
 */
function toVippsCreateError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('"7010"') || message.includes("Customer not found")) {
    return new BadRequestException(
      "Nummeret er ikke registrert i Vipps, eller kunden kan ikke betale til oss. Sjekk nummeret eller registrer kortbetaling.",
    );
  }
  Sentry.captureException(error);
  return new Error("Vipps svarte ikke som forventet. Prøv igjen eller registrer kortbetaling.");
}

function isActive(customerItem: CustomerItem): boolean {
  return (
    customerItem.handout &&
    !customerItem.returned &&
    !customerItem.buyout &&
    !customerItem.cancel &&
    !customerItem.buyback
  );
}

async function placeWithPayment(order: Order, method: PaymentMethod | null): Promise<Order> {
  let paymentIds = order.payments;
  if (method !== null && order.amount > 0) {
    const payment = await StorageService.Payments.add({
      method,
      order: order.id,
      amount: order.amount,
      customer: order.customer,
      branch: order.branch,
      confirmed: false,
    });
    paymentIds = [...paymentIds, payment.id];
  }
  const orderWithPayment = await StorageService.Orders.update(order.id, { payments: paymentIds });
  return new OrderPlacedHandler().placeOrder(orderWithPayment, order.customer);
}

async function present(order: Order, status: StandCheckoutStatus): Promise<StandCheckoutState> {
  return {
    orderId: order.id,
    status,
    order:
      status === "paid"
        ? await OrderHistoryService.getOne(order.id, order.customer, "employee")
        : null,
  };
}

async function settleAuthorizedVippsPayment(order: Order): Promise<StandCheckoutState> {
  const placed = await placeWithPayment(order, "vipps-epayment");
  await StorageService.Orders.update(order.id, { checkoutState: CHECKOUT_STATE.paid });
  try {
    await VippsPaymentService.payment.capture(order.id, order.amount * 100);
  } catch (error) {
    Sentry.captureException(error);
  }
  return present(placed, "paid");
}

async function markVippsOutcome(
  order: Order,
  status: Exclude<StandCheckoutStatus, "pending" | "paid">,
): Promise<StandCheckoutState> {
  await StorageService.Orders.update(order.id, { checkoutState: CHECKOUT_STATE[status] });
  return present(order, status);
}

export const StandCheckoutService = {
  /**
   * Extends or buys out one book for a customer at the stand. Card payments are recorded and the
   * order is placed at once; Vipps payments push a request to the customer's phone and the order
   * waits, to be settled by `status()` once the customer has answered.
   */
  async start({
    customerItemId,
    action,
    payment,
    employeeDetailsId,
  }: {
    customerItemId: string;
    action: StandCheckoutAction;
    payment: StandPayment;
    employeeDetailsId: string;
  }): Promise<StandCheckoutState> {
    const customerItem = await StorageService.CustomerItems.getOrNull(customerItemId);
    if (!customerItem || !isActive(customerItem)) {
      throw new BadRequestException("Kunden har ikke denne boka lenger");
    }
    const branch = await StorageService.Branches.getOrNull(customerItem.handoutInfo?.handoutById);
    if (!branch) {
      throw new BadRequestException("Fant ikke filialen som boka er utdelt på");
    }

    if (action.type === "extend") {
      const extension = calculateExtensionStatus(customerItem, branch);
      if (!extension.canExtend) {
        throw new BadRequestException(extension.feedback);
      }
      const period = availableExtendPeriods(customerItem, branch).find((candidate) =>
        isSameDeadlineDay(candidate.date, action.to),
      );
      if (!period) {
        throw new BadRequestException("Filialen tilbyr ikke forlenging til denne datoen");
      }
    } else {
      const buyout = await calculateBuyoutStatus(customerItem, branch);
      if (!buyout.canBuyout) {
        throw new BadRequestException(buyout.feedback);
      }
    }

    // Resolved before the order exists, so a bad number never leaves an orphaned order behind
    const phoneNumber = payment.method === "vipps" ? toMsisdn(payment.phoneNumber) : null;

    const order = await OrderService.createFromCart(
      customerItem.customer,
      [
        {
          id: customerItem.item,
          branchId: branch.id,
          type: action.type,
          ...(action.type === "extend" ? { to: action.to } : {}),
        },
      ],
      { byCustomer: false, employee: employeeDetailsId },
    );

    if (phoneNumber === null || order.amount === 0) {
      return present(await placeWithPayment(order, phoneNumber === null ? "card" : null), "paid");
    }

    const [orderItem] = order.orderItems;
    try {
      await VippsPaymentService.payment.create({
        amount: { currency: "NOK", value: order.amount * 100 },
        paymentMethod: { type: "WALLET" },
        customer: { phoneNumber },
        reference: order.id,
        userFlow: "PUSH_MESSAGE",
        customerInteraction: "CUSTOMER_PRESENT",
        paymentDescription:
          action.type === "extend"
            ? `Forleng «${orderItem?.title ?? "bok"}» til ${DateService.format(action.to, "Europe/Oslo", "DD/MM/YYYY")}`
            : `Kjøp ut «${orderItem?.title ?? "bok"}»`,
      });
    } catch (error) {
      // Nothing was asked of the customer, so the order should not linger as a half-made one
      await StorageService.Orders.remove(order.id);
      throw toVippsCreateError(error);
    }
    await StorageService.Orders.update(order.id, { checkoutState: CHECKOUT_STATE.created });
    return present(order, "pending");
  },

  /**
   * Asks Vipps how the request went and places the order the first time it comes back approved.
   * Safe to call repeatedly: a placed order is reported as paid without touching Vipps again.
   */
  async status(orderId: string): Promise<StandCheckoutState> {
    const order = await StorageService.Orders.get(orderId);
    if (order.placed) {
      return present(order, "paid");
    }
    switch (order.checkoutState) {
      case CHECKOUT_STATE.aborted: {
        return present(order, "aborted");
      }
      case CHECKOUT_STATE.expired: {
        return present(order, "expired");
      }
      case CHECKOUT_STATE.cancelled: {
        return present(order, "cancelled");
      }
      case CHECKOUT_STATE.created:
      case CHECKOUT_STATE.paid: {
        break;
      }
      default: {
        throw new BadRequestException("Denne ordren venter ikke på en Vipps-betaling");
      }
    }

    const payment = await VippsPaymentService.payment.info(order.id);
    switch (payment.state) {
      case "AUTHORIZED": {
        return settleAuthorizedVippsPayment(order);
      }
      case "ABORTED": {
        return markVippsOutcome(order, "aborted");
      }
      case "EXPIRED": {
        return markVippsOutcome(order, "expired");
      }
      case "TERMINATED": {
        return markVippsOutcome(order, "cancelled");
      }
      default: {
        return present(order, "pending");
      }
    }
  },

  /** The employee gives up waiting. If the customer approved in the meantime, the order is settled instead. */
  async cancel(orderId: string): Promise<StandCheckoutState> {
    const order = await StorageService.Orders.get(orderId);
    if (order.placed) {
      return present(order, "paid");
    }
    if (order.checkoutState !== CHECKOUT_STATE.created) {
      return StandCheckoutService.status(orderId);
    }
    try {
      await VippsPaymentService.payment.cancel(order.id);
    } catch (error) {
      // Typically the customer approved just now; the status check below settles it
      logger.warn(`could not cancel Vipps payment for order ${order.id}: ${String(error)}`);
      return StandCheckoutService.status(orderId);
    }
    return markVippsOutcome(order, "cancelled");
  },
};
