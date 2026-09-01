import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { Delivery } from "#shared/delivery/delivery";
import type { Order } from "#shared/order/order";
import type { Payment } from "#shared/payment/payment";

export class PaymentValidator {
  public validate(payment?: Payment): Promise<boolean> {
    if (!payment) {
      return Promise.reject(new BlError("payment is not defined"));
    }

    let order: Order;

    return StorageService.Orders.get(payment.order)
      .then((orderInStorage: Order) => {
        order = orderInStorage;
        return this.validateIfOrderHasDelivery(payment, order);
      })
      .then(() => this.validatePaymentBasedOnMethod(payment))
      .catch((validatePaymentError: unknown) => {
        if (validatePaymentError instanceof BlError) {
          throw validatePaymentError;
        }
        throw new BlError("could not validate payment, unknown error").store(
          "error",
          validatePaymentError,
        );
      });
  }

  private validateIfOrderHasDelivery(payment: Payment, order: Order): Promise<boolean> {
    if (!order.delivery) {
      return Promise.resolve(true);
    }

    return StorageService.Deliveries.get(order.delivery).then((delivery: Delivery) => {
      const expectedAmount = order.amount + delivery.amount;

      if (payment.amount !== expectedAmount) {
        throw new BlError(
          `payment.amount "${payment.amount}" is not equal to (order.amount + delivery.amount) "${expectedAmount}"`,
        );
      }
      return true;
    });
  }

  private validatePaymentBasedOnMethod(payment: Payment): boolean {
    if (["card", "cash", "vipps"].includes(payment.method)) {
      return true;
    }
    throw new BlError(`payment.method "${payment.method}" not supported`);
  }
}
