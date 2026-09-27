import { DateTime } from "luxon";

import Delivery from "#models/delivery";
import type Order from "#models/order";
import Payment from "#models/payment";
import { BlError } from "#shared/bl-error";

export class PaymentHandler {
  /**
   * Confirms the payments recorded for a placed order, once they add up to what the order and its
   * delivery cost and every method is permitted for whoever placed it.
   */
  public async confirmPayments(order: Order): Promise<void> {
    const payments = await Payment.ofOrder(order.id);
    if (payments.length <= 0) {
      return;
    }

    await this.validateOrderAmount(order, payments);
    const unconfirmed = payments.filter((payment) => !payment.confirmed);
    // Every method is checked before any payment is confirmed.
    for (const payment of unconfirmed) {
      this.validateMethod(order, payment);
    }
    await Payment.query()
      .whereIn(
        "id",
        unconfirmed.map(({ id }) => id),
      )
      .update({ confirmed: true, updatedAt: DateTime.now() });
  }

  private validateMethod(order: Order, payment: Payment): void {
    if (["card", "cash", "vipps", "bank-transfer"].includes(payment.method)) {
      if (order.byCustomer) {
        throw new BlError(`payment method "${payment.method}" is not permitted for customer`);
      }
      return;
    }

    if (payment.method === "vipps-checkout" || payment.method === "vipps-epayment") {
      return;
    }

    throw new BlError(`payment method "${payment.method}" not supported`);
  }

  private async validateOrderAmount(order: Order, payments: Payment[]): Promise<void> {
    const total = payments.reduce((subTotal, payment) => subTotal + payment.amount, 0);
    let orderTotal = order.amount;

    const delivery = await Delivery.ofOrder(order.id);
    if (delivery) {
      orderTotal += delivery.amount;
    }

    if (total !== orderTotal) {
      throw new BlError("total of payment amounts does not equal order.amount + delivery.amount");
    }
  }
}
