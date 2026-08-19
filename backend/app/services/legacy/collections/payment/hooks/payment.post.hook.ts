import { PaymentValidator } from "#services/legacy/collections/payment/helpers/payment.validator";
import { Hook } from "#services/legacy/hook";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { Payment } from "#shared/payment/payment";

export class PaymentPostHook extends Hook {
  private paymentValidator: PaymentValidator;

  constructor(paymentValidator?: PaymentValidator) {
    super();
    this.paymentValidator = paymentValidator ?? new PaymentValidator();
  }

  public override before(): Promise<boolean> {
    return new Promise((resolve) => {
      resolve(true);
    });
  }

  public override async after(payments: Payment[]): Promise<Payment[]> {
    if (!payments || payments.length != 1) {
      throw new BlError("payments is empty or undefined");
    }

    const payment = payments[0];
    if (!payment) return [];

    try {
      await this.paymentValidator.validate(payment);
    } catch (error) {
      throw new BlError("payment could not be validated").add(error as BlError);
    }

    await this.updateOrderWithPayment(payment);
    return [payment];
  }

  private async updateOrderWithPayment(payment: Payment): Promise<void> {
    let order;
    try {
      order = await StorageService.Orders.get(payment.order);
    } catch {
      throw new BlError("could not get order when adding payment id");
    }

    const paymentIds = order.payments ?? [];
    if (paymentIds.includes(payment.id)) {
      throw new BlError(`order.payments already includes payment "${payment.id}"`);
    }

    try {
      await StorageService.Orders.update(order.id, {
        payments: [...paymentIds, payment.id],
      });
    } catch (error) {
      throw new BlError("order could not be updated with paymentId").add(error as BlError);
    }
  }
}
