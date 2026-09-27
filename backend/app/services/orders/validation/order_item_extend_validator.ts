import type OrderItem from "#models/order_item";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { Branch } from "#shared/branch";

export class OrderItemExtendValidator {
  public async validate(branch: Branch, orderItem: OrderItem): Promise<boolean> {
    try {
      const customerItemId = this.validateFields(orderItem);
      this.checkPeriodType(orderItem, branch);
      await this.validateCustomerItem(branch, orderItem, customerItemId);
    } catch (error) {
      if (error instanceof BlError) {
        throw error;
      }
      throw new BlError('unknown error, could not validate orderItem.type "extend"').store(
        "error",
        error,
      );
    }

    return true;
  }

  /** @returns the id of the customer item the line extends */
  private validateFields(orderItem: OrderItem): string {
    if (orderItem.type !== "extend") {
      throw new BlError(`orderItem.type "${orderItem.type}" is not "extend"`);
    }

    if (!orderItem.customerItemId) {
      throw new BlError("orderItem.customerItemId is not defined");
    }

    return orderItem.customerItemId;
  }

  private async validateCustomerItem(
    branch: Branch,
    orderItem: OrderItem,
    customerItemId: string,
  ): Promise<boolean> {
    const customerItem = await StorageService.CustomerItems.get(customerItemId);
    if (!customerItem.periodExtends) {
      return true;
    }

    let totalOfSelectedPeriod = 0;
    for (const periodExtend of customerItem.periodExtends) {
      if (periodExtend.periodType === orderItem.periodType) {
        totalOfSelectedPeriod += 1;
      }
    }

    for (const extendPeriod of branch.extendPeriods) {
      if (
        extendPeriod.type === orderItem.periodType &&
        totalOfSelectedPeriod > extendPeriod.maxNumberOfPeriods
      ) {
        throw new BlError("orderItem can not be extended any more times");
      }
    }

    return true;
  }

  private checkPeriodType(orderItem: OrderItem, branch: Branch) {
    if (branch.extendPeriods.length === 0) {
      throw new BlError("the branch has no extendPeriods defined");
    }

    for (const extendPeriod of branch.extendPeriods) {
      if (extendPeriod.type === orderItem.periodType) {
        return true;
      }
    }

    throw new BlError(
      `orderItem.periodType is "${orderItem.periodType}" but it is not allowed by branch`,
    );
  }
}
