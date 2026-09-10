import * as Sentry from "@sentry/node";
import { DateTime } from "luxon";

import { findPaidOrderForCustomerItem } from "#services/stand_cart/stand_cart_line_resolver";
import type { CheckoutLine } from "#services/stand_cart/stand_cart_order_builder";
import { StorageService } from "#services/storage_service";
import { TranslationService } from "#services/translation_service";
import { VippsPaymentService } from "#services/vipps/vipps_payment_service";
import type { Order } from "#shared/order/order";
import type { Payment } from "#shared/payment/payment";
import type {
  RefundableVippsMethod,
  StandCartRefundPlan,
  StandCartVippsRefund,
} from "#shared/stand_cart";
import { USER_PERMISSION } from "#shared/user-permission";

/** Vipps refunds a captured payment for this long after it was made. */
const REFUND_WINDOW_DAYS = 365;

export const REFUND_SHORTFALL_REASON =
  "Beløpet er større enn det Vipps kan refundere på betalingene";

/** A Vipps transaction behind a refund line, with what Vipps still allows refunding on it. */
export interface RefundableTransaction {
  orderId: string;
  method: RefundableVippsMethod;
  refundable: number;
}

/** A refund line's transaction, or the sentence that sends the whole refund to the manual route. */
type TracedLine =
  | { kind: "transaction"; orderId: string; payment: Payment; method: RefundableVippsMethod }
  | { kind: "manual"; reason: string };

function isRefundableVippsMethod(method: Payment["method"]): method is RefundableVippsMethod {
  return method === "vipps-checkout" || method === "vipps-epayment";
}

/** The order a refund line gives money back for, or null when there is no such order. */
async function paidOrderOf(line: CheckoutLine): Promise<Order | null> {
  switch (line.context.kind) {
    case "order": {
      return line.context.order;
    }
    case "customerItem": {
      const paid = await findPaidOrderForCustomerItem(line.context.customerItem);
      return paid?.order ?? null;
    }
    default: {
      return null;
    }
  }
}

async function paymentsOf(order: Order): Promise<Payment[]> {
  return order.payments.length === 0
    ? []
    : StorageService.Payments.getMany(order.payments, USER_PERMISSION.ADMIN);
}

function paidWithReason(title: string, method: Payment["method"]): string {
  switch (method) {
    case "cash": {
      return `«${title}» ble betalt kontant`;
    }
    case "card": {
      return `«${title}» ble betalt med kort`;
    }
    case "vipps": {
      return `«${title}» ble betalt manuelt med Vipps`;
    }
    default: {
      return `«${title}» ble betalt med ${TranslationService.translatePaymentMethod(method)}`;
    }
  }
}

async function trace(line: CheckoutLine, now: Date): Promise<TracedLine> {
  const title = line.line.title;
  if (line.option.type === "sell") {
    return { kind: "manual", reason: `«${title}» er et innkjøp, ikke en refusjon av en betaling` };
  }
  const order = await paidOrderOf(line);
  const payment = order
    ? (await paymentsOf(order)).find((candidate) => candidate.amount > 0)
    : null;
  if (!order || !payment) {
    return { kind: "manual", reason: `«${title}» har ingen betaling å refundere` };
  }
  if (!isRefundableVippsMethod(payment.method)) {
    return { kind: "manual", reason: paidWithReason(title, payment.method) };
  }
  const paidAt = DateTime.fromJSDate(payment.creationTime ?? new Date(0));
  if (paidAt < DateTime.fromJSDate(now).minus({ days: REFUND_WINDOW_DAYS })) {
    return { kind: "manual", reason: `«${title}» ble betalt for over ett år siden` };
  }
  return { kind: "transaction", orderId: order.id, payment, method: payment.method };
}

/** Vipps answers 404 with error code 5090 when the reference was never a payment of ours. */
function isUnknownReference(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('"5090"');
}

/**
 * Asks Vipps what is left to refund on the transaction, or why it cannot say. An unknown
 * reference is expected for payments made against another sales unit; anything else is a
 * Sentry matter as well as a reason to go manual.
 */
async function refundableOn(
  orderId: string,
  title: string,
): Promise<{ refundable: number } | { reason: string }> {
  try {
    const { aggregate } = await VippsPaymentService.payment.info(orderId);
    return { refundable: (aggregate.capturedAmount.value - aggregate.refundedAmount.value) / 100 };
  } catch (error) {
    if (isUnknownReference(error)) {
      return { reason: `Fant ingen Vipps-betaling for «${title}»` };
    }
    Sentry.captureException(error, { extra: { orderId } });
    return { reason: `Vipps svarte ikke på spørsmål om betalingen for «${title}»` };
  }
}

/**
 * Pure: how a total splits across the transactions, in order, each taking what Vipps still
 * allows on it. Null when they cannot cover the total between them.
 */
export function allocateRefund(
  total: number,
  transactions: RefundableTransaction[],
): StandCartVippsRefund[] | null {
  const refunds: StandCartVippsRefund[] = [];
  let left = total;
  for (const transaction of transactions) {
    const amount = Math.min(left, transaction.refundable);
    if (amount <= 0) {
      continue;
    }
    refunds.push({ orderId: transaction.orderId, method: transaction.method, amount });
    left -= amount;
  }
  return left > 0 ? null : refunds;
}

export const StandCartRefund = {
  /**
   * How the money goes back for a cart whose lines add up to a refund. Every refund line must
   * trace to a Vipps transaction for the refund to be automatic; the net total is then split
   * across those transactions. Null when the lines refund nothing.
   */
  async plan(lines: CheckoutLine[], now: Date): Promise<StandCartRefundPlan | null> {
    const total = lines.reduce((sum, line) => sum + line.option.price, 0);
    const refundLines = lines.filter((line) => line.option.price < 0);
    if (refundLines.length === 0 || total >= 0) {
      return null;
    }

    const traced = await Promise.all(refundLines.map((line) => trace(line, now)));
    const reasons = traced.flatMap((result) => (result.kind === "manual" ? [result.reason] : []));
    if (reasons.length > 0) {
      return { kind: "manual", reasons };
    }

    const transactions: RefundableTransaction[] = [];
    const seen = new Set<string>();
    for (const [index, result] of traced.entries()) {
      if (result.kind !== "transaction" || seen.has(result.orderId)) {
        continue;
      }
      seen.add(result.orderId);
      const answer = await refundableOn(result.orderId, refundLines[index]?.line.title ?? "");
      if ("reason" in answer) {
        return { kind: "manual", reasons: [answer.reason] };
      }
      transactions.push({
        orderId: result.orderId,
        method: result.method,
        refundable: answer.refundable,
      });
    }

    const refunds = allocateRefund(-total, transactions);
    return refunds === null
      ? { kind: "manual", reasons: [REFUND_SHORTFALL_REASON] }
      : { kind: "vipps", refunds };
  },
};
