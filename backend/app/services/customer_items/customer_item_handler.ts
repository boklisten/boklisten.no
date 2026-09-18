import BranchModel from "#models/branch";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { Branch, ExtendPeriod } from "#shared/branch";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { OrderItem } from "#shared/order/order-item/order-item";
import type { Period } from "#shared/period";

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
    orderId: string,
  ): Promise<CustomerItem> {
    const customerItem = await StorageService.CustomerItems.get(customerItemId);

    if (customerItem.returned) {
      throw new BlError("can not extend when returned is true");
    }

    if (orderItem.type !== "extend") {
      throw new BlError('orderItem.type is not "extend"');
    }

    if (!orderItem.info || !orderItem.info.periodType) {
      throw new BlError('orderItem info is not present when type is "extend"');
    }

    const branch = await BranchModel.findOrFail(branchId);

    this.getExtendPeriod(branch, orderItem.info.periodType);

    const periodExtends = customerItem.periodExtends ?? [];

    const customerItemOrders = customerItem.orders ?? [];

    periodExtends.push({
      // @ts-expect-error fixme: auto ignored
      from: orderItem.info.from,

      // @ts-expect-error fixme: auto ignored
      to: orderItem.info.to,
      periodType: orderItem.info.periodType,
      time: new Date(),
    });

    customerItemOrders.push(orderId);
    return StorageService.CustomerItems.update(customerItemId, {
      deadline: orderItem.info.to,
      periodExtends,
      orders: customerItemOrders,
    });
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

    const customerItem = await StorageService.CustomerItems.get(customerItemId);
    const customerItemOrders = customerItem.orders ?? [];

    customerItemOrders.push(orderId);

    return StorageService.CustomerItems.update(customerItemId, {
      buyout: true,
      orders: customerItemOrders,
      buyoutInfo: {
        order: orderId,
        time: new Date(),
      },
    });
  }

  /**
   * Returns a customer item
   * @param customerItemId
   * @param orderId
   * @param orderItem
   */
  public async return(
    customerItemId: string,
    orderId: string,
    orderItem: OrderItem,
    branchId: string,
    employeeId: string,
  ) {
    if (orderItem.type !== "return") {
      throw new BlError(`orderItem.type is not "return"`);
    }

    const customerItem = await StorageService.CustomerItems.get(customerItemId);

    const customerItemOrders = customerItem.orders ?? [];

    customerItemOrders.push(orderId);

    return StorageService.CustomerItems.update(customerItemId, {
      returned: true,
      orders: customerItemOrders,
      returnInfo: {
        returnedToId: branchId,
        returnEmployee: employeeId,
        time: new Date(),
      },
    });
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

    const customerItem = await StorageService.CustomerItems.get(customerItemId);

    const customerItemOrders = customerItem.orders ?? [];

    customerItemOrders.push(orderId);

    return StorageService.CustomerItems.update(customerItemId, {
      returned: true,
      orders: customerItemOrders,
      cancel: true,
      cancelInfo: {
        time: new Date(),
        order: orderId,
      },
    });
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

    const customerItem = await StorageService.CustomerItems.get(customerItemId);
    const customerItemOrders = customerItem.orders ?? [];

    customerItemOrders.push(orderId);

    return StorageService.CustomerItems.update(customerItemId, {
      returned: true,
      orders: customerItemOrders,
      buyback: true,
      buybackInfo: {
        order: orderId,
        time: new Date(),
      },
    });
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
