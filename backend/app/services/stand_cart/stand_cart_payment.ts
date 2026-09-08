import * as Sentry from "@sentry/node";
import logger from "@adonisjs/core/services/logger";

import BadRequestException from "#exceptions/bad_request_exception";
import { StorageService } from "#services/storage_service";
import { VippsPaymentService } from "#services/vipps/vipps_payment_service";
import type { Order } from "#shared/order/order";
import type { PaymentMethod } from "#shared/payment/payment-method/payment-method";

/**
 * Where a Vipps request stands. The Vipps Checkout vocabulary is reused on `order.checkoutState`
 * so one field tells the story for both the online and the stand flow.
 */
export const VIPPS_REQUEST_STATE = {
  created: "SessionCreated",
  paid: "PaymentSuccessful",
  aborted: "PaymentTerminated",
  expired: "SessionExpired",
  cancelled: "PaymentCancelled",
} as const;

type VippsRequestOutcome = "authorized" | "pending" | "aborted" | "expired" | "cancelled";

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
function toVippsCreateError(error: unknown): BadRequestException {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('"7010"') || message.includes("Customer not found")) {
    return new BadRequestException(
      "Nummeret er ikke registrert i Vipps, eller kunden kan ikke betale til oss. Sjekk nummeret eller registrer kortbetaling.",
    );
  }
  Sentry.captureException(error);
  return new BadRequestException(
    "Vipps svarte ikke som forventet. Prøv igjen eller registrer kortbetaling.",
  );
}

export const StandCartPayment = {
  /** Records an unconfirmed payment for the whole order and returns the order pointing at it. */
  async record(order: Order, method: PaymentMethod): Promise<Order> {
    const payment = await StorageService.Payments.add({
      method,
      order: order.id,
      amount: order.amount,
      customer: order.customer,
      branch: order.branch,
      confirmed: false,
    });
    return StorageService.Orders.update(order.id, { payments: [...order.payments, payment.id] });
  },

  /**
   * Pushes a payment request to the customer's phone. Nothing has been asked of the customer if
   * Vipps refuses, so the half-made order is removed rather than left lingering.
   */
  async requestVipps(order: Order, msisdn: string, description: string): Promise<void> {
    try {
      await VippsPaymentService.payment.create({
        amount: { currency: "NOK", value: order.amount * 100 },
        paymentMethod: { type: "WALLET" },
        customer: { phoneNumber: msisdn },
        reference: order.id,
        userFlow: "PUSH_MESSAGE",
        customerInteraction: "CUSTOMER_PRESENT",
        paymentDescription: description,
      });
    } catch (error) {
      await StorageService.Orders.remove(order.id);
      throw toVippsCreateError(error);
    }
    await StorageService.Orders.update(order.id, { checkoutState: VIPPS_REQUEST_STATE.created });
  },

  /** Asks Vipps how the request went. */
  async vippsOutcome(order: Order): Promise<VippsRequestOutcome> {
    const payment = await VippsPaymentService.payment.info(order.id);
    switch (payment.state) {
      case "AUTHORIZED": {
        return "authorized";
      }
      case "ABORTED": {
        return "aborted";
      }
      case "EXPIRED": {
        return "expired";
      }
      case "TERMINATED": {
        return "cancelled";
      }
      default: {
        return "pending";
      }
    }
  },

  /** Capture is fire-and-forget: the money is reserved, and a failed capture is a Sentry matter. */
  async captureVipps(order: Order): Promise<void> {
    try {
      await VippsPaymentService.payment.capture(order.id, order.amount * 100);
    } catch (error) {
      Sentry.captureException(error);
    }
  },

  /** Withdraws the request; false when Vipps would not, typically because the customer just approved. */
  async cancelVipps(order: Order): Promise<boolean> {
    try {
      await VippsPaymentService.payment.cancel(order.id);
      return true;
    } catch (error) {
      logger.warn(`could not cancel Vipps payment for order ${order.id}: ${String(error)}`);
      return false;
    }
  },
};
