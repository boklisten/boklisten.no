import type OrderItem from "#models/order_item";
import { isNullish } from "#services/typescript_helpers";
import { BlError } from "#shared/bl-error";
import type { Branch } from "#shared/branch";
import type { Item } from "#shared/item";
import type { Period } from "#shared/period";

export class OrderItemPartlyPaymentValidator {
  public async validate(orderItem: OrderItem, _item: Item, branch: Branch): Promise<boolean> {
    if (orderItem.type !== "partly-payment") {
      throw new BlError("orderItem not of type 'partly-payment'");
    }

    this.validateFields(orderItem);

    if (!this.isPeriodSupported(orderItem.periodType, branch)) {
      throw new BlError(`partly-payment period "${orderItem.periodType}" not supported on branch`);
    }

    return true;
  }

  private isPeriodSupported(period: Period | null, branch: Branch) {
    return branch.partlyPaymentPeriods.some(
      (partlyPaymentPeriod) => partlyPaymentPeriod.type === period,
    );
  }

  private validateFields(orderItem: OrderItem) {
    if (isNullish(orderItem.periodTo)) {
      throw new BlError("orderItem.periodTo not specified");
    }

    if (isNullish(orderItem.amountLeftToPay)) {
      throw new BlError("orderItem.amountLeftToPay not specified");
    }
  }
}
