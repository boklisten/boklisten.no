import { isNullish } from "#services/legacy/typescript-helpers";
import { BlError } from "#shared/bl-error";
import type { Branch } from "#shared/branch";
import type { OrderItem } from "#shared/order/order-item/order-item";

export class OrderItemPartlyPaymentValidator {
  public validate(
    orderItem: OrderItem,

    // @ts-expect-error fixme: auto ignored
    Item: Item,
    branch: Branch,
  ): Promise<boolean> {
    if (orderItem.type !== "partly-payment") {
      return Promise.reject(new BlError("orderItem not of type 'partly-payment'"));
    }

    try {
      this.validateFields(orderItem);
    } catch (error) {
      return Promise.reject(error);
    }

    // @ts-expect-error fixme: auto ignored
    if (!this.isPeriodSupported(orderItem.info.periodType, branch)) {
      return Promise.reject(
        new BlError(
          // @ts-expect-error fixme: auto ignored
          `partly-payment period "${orderItem.info.periodType}" not supported on branch`,
        ),
      );
    }

    return new Promise((resolve) => {
      resolve(true);
    });
  }

  private isPeriodSupported(period: any, branch: Branch) {
    if (branch.paymentInfo && branch.paymentInfo.partlyPaymentPeriods) {
      for (const partlyPaymentPeriod of branch.paymentInfo.partlyPaymentPeriods) {
        if (partlyPaymentPeriod.type === period) {
          return true;
        }
      }
    }

    return false;
  }

  private validateFields(orderItem: OrderItem) {
    if (isNullish(orderItem.info)) {
      throw new BlError("orderItem.info not specified");
    }

    if (orderItem.info && isNullish(orderItem.info.to)) {
      throw new BlError("orderItem.info.to not specified");
    }

    if (orderItem.info && isNullish(orderItem.info.amountLeftToPay)) {
      throw new BlError("orderItem.info.amountLeftToPay not specified");
    }
  }
}
