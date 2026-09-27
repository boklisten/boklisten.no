import { DateTime } from "luxon";

import Branch from "#models/branch";
import type CustomerItem from "#models/customer_item";
import type { NewOrderItem } from "#models/order";
import { periodTypeOfLastOrder, resolveBuyoutPrice } from "#services/customer_item_actions_service";
import type { Item } from "#shared/item";

/** Deadlines are compared as Oslo calendar days, so a date picked in a form matches the branch period. */
function isSameDeadlineDay(a: Date, b: Date): boolean {
  return DateTime.fromJSDate(a).hasSame(DateTime.fromJSDate(b), "day");
}

export const OrderItemService = {
  async createBuyoutOrderItem(customerItem: CustomerItem, item: Item) {
    const branch = await Branch.findOptional(customerItem.handoutBranchId);
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
      itemId: item.id,
      handout: false,
      delivered: false,
      amount: price,
      unitPrice: price,
      customerItemId: customerItem.id,
    } as const satisfies NewOrderItem;
  },

  async createExtendOrderItem(customerItem: CustomerItem, item: Item, to: Date) {
    const branch = await Branch.getOrFail(customerItem.handoutBranchId);
    const extendPeriod = branch.extendPeriods.find((period) => isSameDeadlineDay(period.date, to));
    if (!extendPeriod) {
      throw new Error(
        `Extend period not found in checkout customer: ${customerItem.customerId}, branch: ${branch.id}, customer item: ${customerItem.id}`,
      );
    }

    if (customerItem.periodExtends.length >= extendPeriod.maxNumberOfPeriods) {
      throw new Error(
        `Customer item does not qualify for extension: ${customerItem.customerId}, branch: ${branch.id}, customer item: ${customerItem.id}`,
      );
    }

    return {
      type: "extend",
      itemId: item.id,
      handout: false,
      delivered: false,
      amount: extendPeriod.price,
      unitPrice: extendPeriod.price,
      periodFrom: DateTime.now(),
      periodTo: DateTime.fromJSDate(extendPeriod.date),
      numberOfPeriods: 1,
      periodType: extendPeriod.type,
      customerItemId: customerItem.id,
    } as const satisfies NewOrderItem;
  },
  createBuyOrderItem(item: Item) {
    const price = Math.floor(item.price / 10) * 10;
    return {
      type: "buy",
      itemId: item.id,
      handout: false,
      delivered: false,
      amount: price,
      unitPrice: price,
    } as const satisfies NewOrderItem;
  },
  async createRentOrderItem(item: Item, branchId: string, to: Date) {
    const branch = await Branch.findOrFail(branchId);
    const rentPeriod = branch.rentPeriods.find((period) => isSameDeadlineDay(period.date, to));
    if (!rentPeriod) {
      throw new Error(
        `Rent period not found in checkout branch: ${branchId} to: ${to.toISOString()} item: ${item.id}`,
      );
    }

    return {
      type: "rent",
      itemId: item.id,
      handout: false,
      delivered: false,
      amount: branch.paymentResponsible ? 0 : item.price,
      unitPrice: branch.paymentResponsible ? 0 : item.price,
      periodFrom: DateTime.now(),
      periodTo: DateTime.fromJSDate(rentPeriod.date),
      numberOfPeriods: 1,
      periodType: rentPeriod.type,
    } as const satisfies NewOrderItem;
  },

  async createPartlyPaymentOrderItem(item: Item, branchId: string, to: Date) {
    const branch = await Branch.findOrFail(branchId);
    const partlyPaymentPeriod = branch.partlyPaymentPeriods.find((period) =>
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
      itemId: item.id,
      handout: false,
      delivered: false,
      amount: branch.paymentResponsible ? 0 : priceUpFront,
      unitPrice: branch.paymentResponsible ? 0 : priceUpFront,
      periodFrom: DateTime.now(),
      periodTo: DateTime.fromJSDate(partlyPaymentPeriod.date),
      numberOfPeriods: 1,
      periodType: partlyPaymentPeriod.type,
    } as const satisfies NewOrderItem;
  },
};
