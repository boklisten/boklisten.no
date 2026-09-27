import Delivery from "#models/delivery";
import type Order from "#models/order";
import Payment from "#models/payment";
import { BlError } from "#shared/bl-error";

export class OrderPlacedValidator {
  public async validate(order: Order): Promise<boolean> {
    if (!order.placed) {
      return true;
    }

    if (!this.validateOrderItems(order)) {
      throw new BlError("total of order.orderItems amount is not equal to order.amount");
    }

    const payments = await Payment.ofOrder(order.id);
    if (payments.length <= 0) {
      return true; // if there are no payments, there is no need do do more validation
    }

    return this.validatePayments(order, payments, await Delivery.ofOrder(order.id));
  }

  private validateOrderItems(order: Order): boolean {
    let orderItemTotalAmount = 0;

    for (const orderItem of order.orderItems) {
      orderItemTotalAmount += orderItem.amount;
    }

    return order.amount === orderItemTotalAmount;
  }

  private validatePayments(order: Order, payments: Payment[], delivery: Delivery | null): boolean {
    const totalOrderAmount = order.amount + (delivery ? delivery.amount : 0);
    let paymentTotal = 0;

    for (const payment of payments) {
      if (!payment.confirmed) {
        throw new BlError("payment is not confirmed").store("paymentId", payment.id);
      }
      paymentTotal += payment.amount;
    }

    if (paymentTotal !== totalOrderAmount) {
      throw new BlError(
        "total amount of payments is not equal to total of order.amount + delivery.amount",
      );
    }

    return true;
  }
}
