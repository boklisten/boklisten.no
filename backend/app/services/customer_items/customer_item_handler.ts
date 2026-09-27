import { DateTime } from "luxon";

import BranchModel from "#models/branch";
import CustomerItem from "#models/customer_item";
import type OrderItem from "#models/order_item";
import { BlError } from "#shared/bl-error";
import type { Branch, ExtendPeriod } from "#shared/branch";
import type { Period } from "#shared/period";

/**
 * Applies a placed order's lines to the customer items they name. The order line's
 * `customer_item_id` is what ties the order to the customer item, so nothing here records the
 * order on the customer item beyond the state change it causes.
 */
export class CustomerItemHandler {
  /**
   * Extends the deadline of a customer item
   * @param customerItemId
   * @param orderItem
   */
  public async extend(
    customerItemId: string,
    orderItem: OrderItem,
    branchId: string,
  ): Promise<CustomerItem> {
    const customerItem = await CustomerItem.findOrFail(customerItemId);

    if (customerItem.returned) {
      throw new BlError("can not extend when returned is true");
    }

    if (orderItem.type !== "extend") {
      throw new BlError('orderItem.type is not "extend"');
    }

    if (!orderItem.periodType || !orderItem.periodTo) {
      throw new BlError('orderItem info is not present when type is "extend"');
    }

    const branch = await BranchModel.findOrFail(branchId);

    this.getExtendPeriod(branch, orderItem.periodType);

    await customerItem.related("periodExtends").create({
      periodFrom: orderItem.periodFrom ?? customerItem.deadline,
      periodTo: orderItem.periodTo,
      periodType: orderItem.periodType,
      createdAt: DateTime.now(),
    });
    customerItem.deadline = orderItem.periodTo;
    await customerItem.save();
    return customerItem;
  }

  /**
   * Buyouts a customer item
   * @param customerItemId
   * @param orderId
   * @param orderItem
   */
  public async buyout(customerItemId: string, orderId: string, orderItem: OrderItem) {
    if (orderItem.type !== "buyout") {
      throw new BlError(`orderItem.type is not "buyout"`);
    }

    const customerItem = await CustomerItem.findOrFail(customerItemId);
    return customerItem
      .merge({ buyout: true, buyoutOrderId: orderId, boughtOutAt: DateTime.now() })
      .save();
  }

  /**
   * Returns a customer item
   * @param customerItemId
   * @param orderItem
   */
  public async return(
    customerItemId: string,
    orderItem: OrderItem,
    branchId: string,
    employeeId: string,
  ) {
    if (orderItem.type !== "return") {
      throw new BlError(`orderItem.type is not "return"`);
    }

    const customerItem = await CustomerItem.findOrFail(customerItemId);
    return customerItem
      .merge({
        returned: true,
        returnBranchId: branchId,
        returnEmployeeId: employeeId || null,
        returnedAt: DateTime.now(),
      })
      .save();
  }

  /**
   * Cancels a customer item
   * @param customerItemId
   * @param orderId
   * @param orderItem
   */
  public async cancel(customerItemId: string, orderId: string, orderItem: OrderItem) {
    if (orderItem.type !== "cancel") {
      throw new BlError(`orderItem.type is not "cancel"`);
    }

    const customerItem = await CustomerItem.findOrFail(customerItemId);
    return customerItem
      .merge({ returned: true, cancel: true, cancelOrderId: orderId, cancelledAt: DateTime.now() })
      .save();
  }

  /**
   * Buyback a customer item
   * @param customerItemId
   * @param orderId
   * @param orderItem
   */
  public async buyback(customerItemId: string, orderId: string, orderItem: OrderItem) {
    if (orderItem.type !== "buyback") {
      throw new BlError(`orderItem.type is not "buyback"`);
    }

    const customerItem = await CustomerItem.findOrFail(customerItemId);
    return customerItem
      .merge({
        returned: true,
        buyback: true,
        buybackOrderId: orderId,
        boughtBackAt: DateTime.now(),
      })
      .save();
  }

  private getExtendPeriod(branch: Branch, period: Period): ExtendPeriod {
    if (branch.extendPeriods.length === 0) {
      throw new BlError("no extend periods present on branch");
    }

    const extendPeriod = branch.extendPeriods.find((candidate) => candidate.type === period);
    if (extendPeriod) {
      return extendPeriod;
    }

    throw new BlError(`extend period "${period}" is not present on branch`);
  }
}
