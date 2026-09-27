import type Order from "#models/order";
import { OrderPayments } from "#services/payments/order_payments";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { Payment } from "#shared/payment/payment";

export class PaymentHandler {
  public async confirmPayments(order: Order): Promise<Payment[]> {
    const payments = await OrderPayments.of(order.id);
    if (payments.length <= 0) {
      return [];
    }

    return this.confirmAllPayments(order, payments);
  }

  private async confirmAllPayments(order: Order, payments: Payment[]): Promise<Payment[]> {
    await this.validateOrderAmount(order, payments);

    for (const payment of payments) {
      if (payment.confirmed) {
        continue;
      }

      await this.confirmPayment(order, payment);
      await StorageService.Payments.update(payment.id, { confirmed: true });
    }
    return payments;
  }

  private confirmPayment(order: Order, payment: Payment): Promise<boolean> {
    if (["card", "cash", "vipps", "bank-transfer"].includes(payment.method)) {
      if (order.byCustomer) {
        throw new BlError(`payment method "${payment.method}" is not permitted for customer`);
      }
      return Promise.resolve(true);
    }

    if (payment.method === "vipps-checkout" || payment.method === "vipps-epayment") {
      return Promise.resolve(true);
    }

    return Promise.reject(new BlError(`payment method "${payment.method}" not supported`));
  }

  private async validateOrderAmount(order: Order, payments: Payment[]): Promise<boolean> {
    const total = payments.reduce((subTotal, payment) => subTotal + payment.amount, 0);
    let orderTotal = order.amount;

    if (order.deliveryId) {
      const delivery = await StorageService.Deliveries.get(order.deliveryId);
      orderTotal += delivery.amount;
    }

    if (total !== orderTotal) {
      throw new BlError("total of payment amounts does not equal order.amount + delivery.amount");
    }

    return true;
  }
}
