import type Order from "#models/order";
import { OrderPayments } from "#services/payments/order_payments";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { Delivery } from "#shared/delivery/delivery";
import type { Payment } from "#shared/payment/payment";

export class OrderPlacedValidator {
  public async validate(order: Order): Promise<boolean> {
    if (!order.placed) {
      return true;
    }

    if (!this.validateOrderItems(order)) {
      throw new BlError("total of order.orderItems amount is not equal to order.amount");
    }

    const payments = await OrderPayments.of(order.id);
    if (payments.length <= 0) {
      return true; // if there are no payments, there is no need do do more validation
    }

    if (order.deliveryId === null) {
      return this.validatePayments(order, payments);
    }

    let delivery: Delivery;
    try {
      delivery = await StorageService.Deliveries.get(order.deliveryId);
    } catch (error) {
      throw new BlError(`delivery "${order.deliveryId}" not found`).store("error", error);
    }
    return this.validatePayments(order, payments, delivery);
  }

  private validateOrderItems(order: Order): boolean {
    let orderItemTotalAmount = 0;

    for (const orderItem of order.orderItems) {
      orderItemTotalAmount += orderItem.amount;
    }

    return order.amount === orderItemTotalAmount;
  }

  private validatePayments(order: Order, payments: Payment[], delivery?: Delivery): boolean {
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
