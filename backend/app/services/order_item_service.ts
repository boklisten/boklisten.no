import { DateTime } from "luxon";

import { periodTypeOfLastOrder, resolveBuyoutPrice } from "#services/customer_item_actions_service";
import { StorageService } from "#services/storage_service";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Item } from "#shared/item";
import type { OrderItem } from "#shared/order/order-item/order-item";

/** Deadlines are compared as Oslo calendar days, so a date picked in a form matches the branch period. */
export function isSameDeadlineDay(a: Date, b: Date): boolean {
  return DateTime.fromJSDate(a)
    .setZone("Europe/Oslo")
    .hasSame(DateTime.fromJSDate(b).setZone("Europe/Oslo"), "day");
}

export const OrderItemService = {
  async createBuyoutOrderItem(customerItem: CustomerItem, item: Item) {
    const branch = await StorageService.Branches.getOrNull(customerItem.handoutInfo?.handoutById);
    const price = resolveBuyoutPrice({
      customerItem,
      item,
      branch,
      periodType: await periodTypeOfLastOrder(customerItem),
    });

    if (price === null) {
      throw new Error("Could not find buyout percentage in checkout!");
    }

    return {
      type: "buyout",
      item: item.id,
      title: item.title,
      handout: false,
      delivered: false,
      amount: price,
      unitPrice: price,
      customerItem: customerItem.id,
    } as const satisfies OrderItem;
  },

  async createExtendOrderItem(customerItem: CustomerItem, item: Item, to: Date) {
    const branch = await StorageService.Branches.get(customerItem.handoutInfo?.handoutById);
    const extendPeriod = branch.paymentInfo?.extendPeriods.find((period) =>
      isSameDeadlineDay(period.date, to),
    );
    if (!extendPeriod) {
      throw new Error(
        `Extend period not found in checkout customer: ${customerItem.customer}, branch: ${branch.id}, customer item: ${customerItem.id}`,
      );
    }

    if ((customerItem.periodExtends?.length ?? 0) >= extendPeriod.maxNumberOfPeriods) {
      throw new Error(
        `Customer item does not qualify for extension: ${customerItem.customer}, branch: ${branch.id}, customer item: ${customerItem.id}`,
      );
    }

    return {
      type: "extend",
      item: item.id,
      title: item.title,
      handout: false,
      delivered: false,
      amount: extendPeriod.price,
      unitPrice: extendPeriod.price,
      info: {
        from: new Date(),
        to: extendPeriod.date,
        numberOfPeriods: 1,
        periodType: extendPeriod.type,
        customerItem: customerItem.id,
      },
    } as const satisfies OrderItem;
  },
  createBuyOrderItem(item: Item) {
    const price = Math.floor(item.price / 10) * 10;
    return {
      type: "buy",
      item: item.id,
      title: item.title,
      handout: false,
      delivered: false,
      amount: price,
      unitPrice: price,
    } as const satisfies OrderItem;
  },
  async createRentOrderItem(item: Item, branchId: string, to: Date) {
    const branch = await StorageService.Branches.get(branchId);
    const rentPeriod = branch.paymentInfo?.rentPeriods.find((period) =>
      isSameDeadlineDay(period.date, to),
    );
    if (!rentPeriod) {
      throw new Error(
        `Rent period not found in checkout branch: ${branchId} to: ${to.toISOString()} item: ${item.id}`,
      );
    }

    return {
      type: "rent",
      item: item.id,
      title: item.title,
      handout: false,
      delivered: false,
      amount: branch.paymentInfo?.responsible ? 0 : item.price,
      unitPrice: branch.paymentInfo?.responsible ? 0 : item.price,
      info: {
        from: new Date(),
        to: rentPeriod.date,
        numberOfPeriods: 1,
        periodType: rentPeriod.type,
      },
    } as const satisfies OrderItem;
  },

  async createPartlyPaymentOrderItem(item: Item, branchId: string, to: Date) {
    const branch = await StorageService.Branches.get(branchId);
    const partlyPaymentPeriod = branch.paymentInfo?.partlyPaymentPeriods?.find((period) =>
      isSameDeadlineDay(period.date, to),
    );
    if (!partlyPaymentPeriod) {
      throw new Error(
        `Rent period not found in checkout branch: ${branchId} to: ${to.toISOString()} item: ${item.id}`,
      );
    }

    const priceUpFront = Math.floor((item.price * partlyPaymentPeriod.percentageUpFront) / 10) * 10;

    return {
      type: "partly-payment",
      item: item.id,
      title: item.title,
      handout: false,
      delivered: false,
      amount: branch.paymentInfo?.responsible ? 0 : priceUpFront,
      unitPrice: branch.paymentInfo?.responsible ? 0 : priceUpFront,
      info: {
        from: new Date(),
        to: partlyPaymentPeriod.date,
        numberOfPeriods: 1,
        periodType: partlyPaymentPeriod.type,
      },
    } as const satisfies OrderItem;
  },
};
