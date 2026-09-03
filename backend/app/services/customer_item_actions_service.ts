import { DateTime } from "luxon";

import { DateService } from "#services/legacy/date.service";
import { StorageService } from "#services/storage_service";
import type { Branch } from "#shared/branch";
import type {
  CustomerItemAction,
  CustomerItemStatus,
} from "#shared/customer-item/actionable_customer_item";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Item } from "#shared/item";
import type { Period } from "#shared/period";

export type ExtendPeriod = NonNullable<Branch["paymentInfo"]>["extendPeriods"][number];

function isHandedOutWithinTheLastTwoWeeks(customerItem: CustomerItem) {
  const handedOutAt = customerItem.creationTime
    ? DateTime.fromJSDate(customerItem.creationTime)
    : DateTime.now();
  return DateTime.now() <= handedOutAt.plus({ weeks: 2 });
}

function isDeadlineWithGracePeriodExpired(customerItem: CustomerItem) {
  const now = DateTime.now().setZone("Europe/Oslo");

  // December grace period: allow buyout/extension through the holidays until Jan 1 next year.
  const graceDeadline =
    now.month === 12
      ? DateTime.fromObject(
          { year: now.year + 1, month: 1, day: 1 },
          { zone: "Europe/Oslo" },
        ).startOf("day")
      : DateTime.fromJSDate(customerItem.deadline).setZone("Europe/Oslo").endOf("day");

  return now > graceDeadline;
}

function periodsAfterDeadline(customerItem: CustomerItem, branch: Branch): ExtendPeriod[] {
  return (branch.paymentInfo?.extendPeriods ?? []).filter(
    (period) => customerItem.deadline.getTime() < period.date.getTime(),
  );
}

/**
 * The extend periods this book still qualifies for. Every extension counts against a period's
 * cap, whatever type it was; that is also how the order item is validated at checkout.
 */
export function availableExtendPeriods(customerItem: CustomerItem, branch: Branch): ExtendPeriod[] {
  const timesExtended = customerItem.periodExtends?.length ?? 0;
  return periodsAfterDeadline(customerItem, branch).filter(
    (period) => timesExtended < period.maxNumberOfPeriods,
  );
}

export function calculateExtensionStatus(customerItem: CustomerItem, branch: Branch | null) {
  if (!branch) {
    return {
      canExtend: false,
      feedback: "Fant ikke filialen som denne boka er utdelt på. Vennligst ta kontakt for hjelp",
    } as const;
  }

  if (isDeadlineWithGracePeriodExpired(customerItem)) {
    return {
      canExtend: false,
      feedback: "Fristen for å forlenge har utløpt",
    } as const;
  }

  if (periodsAfterDeadline(customerItem, branch).length === 0) {
    return {
      canExtend: false,
      feedback: "Denne filialen tilbyr for øyeblikket ikke forlenging",
    } as const;
  }

  const options = availableExtendPeriods(customerItem, branch);
  if (options.length === 0) {
    return {
      canExtend: false,
      feedback: "Denne boka er allerede forlenget så mange ganger som filialen tillater",
    } as const;
  }

  return {
    canExtend: true,
    feedback: "",
    options: options.map((period) => ({ date: period.date, price: period.price })),
  } as const;
}

/**
 * What the customer pays to keep the book. A partly-payment book has the rest of its price on
 * record; a rental costs a share of the item price, rounded down to the nearest ten.
 */
export function resolveBuyoutPrice({
  customerItem,
  item,
  branch,
  periodType,
}: {
  customerItem: CustomerItem;
  item: Item;
  branch: Branch | null;
  periodType: Period | undefined;
}): number | null {
  const buyoutPercentage =
    branch?.paymentInfo?.partlyPaymentPeriods?.find((period) => period.type === periodType)
      ?.percentageBuyout ?? branch?.paymentInfo?.buyout?.percentage;
  if (!buyoutPercentage) {
    return null;
  }
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- amountLeftToPay can be 0, which deliberately falls through to the computed buyout price
  return customerItem.amountLeftToPay || Math.floor((item.price * buyoutPercentage) / 10) * 10;
}

/** The period type of the order that put the book in the customer's hands. */
export async function periodTypeOfLastOrder(
  customerItem: CustomerItem,
): Promise<Period | undefined> {
  const order = await StorageService.Orders.getOrNull(customerItem.orders.at(-1));
  return order?.orderItems.find((orderItem) => orderItem.customerItem === customerItem.id)?.info
    ?.periodType;
}

export async function calculateBuyoutStatus(customerItem: CustomerItem, branch: Branch | null) {
  if (isDeadlineWithGracePeriodExpired(customerItem)) {
    return {
      canBuyout: false,
      feedback: "Fristen for å kjøpe ut har utløpt",
    } as const;
  }

  if (isHandedOutWithinTheLastTwoWeeks(customerItem)) {
    return {
      canBuyout: false,
      feedback: "Du må ha ha boken i minst 2 uker før du kan kjøpe den ut",
    } as const;
  }

  const item = await StorageService.Items.getOrNull(customerItem.item);
  const price = item
    ? resolveBuyoutPrice({
        customerItem,
        item,
        branch,
        periodType: await periodTypeOfLastOrder(customerItem),
      })
    : null;

  if (price === null) {
    return {
      canBuyout: false,
      feedback: "Klarte ikke beregne utkjøpspris. Vennligst ta kontakt hvis du vil kjøpe ut boka.",
    } as const;
  }

  return {
    canBuyout: true,
    feedback: "",
    price,
  } as const;
}

export function calculateStatus(customerItem: CustomerItem): CustomerItemStatus {
  if (customerItem.buyout) {
    return { type: "buyout", text: "Kjøpt ut" };
  }
  if (customerItem.returned) {
    return { type: "returned", text: "Returnert" };
  }

  if (customerItem.deadline.getTime() < Date.now()) {
    return { type: "overdue", text: "Fristen har utløpt" };
  }

  return { type: "active", text: "Aktiv" };
}

/** The extend and buyout buttons for one book, priced, and disabled with a reason when blocked. */
export async function buildCustomerItemActions(
  customerItem: CustomerItem,
  branch: Branch | null,
): Promise<CustomerItemAction[]> {
  const extensionStatus = calculateExtensionStatus(customerItem, branch);
  const buyoutStatus = await calculateBuyoutStatus(customerItem, branch);

  const extendActions: CustomerItemAction[] = extensionStatus.options?.map((extension) => ({
    type: "extend",
    price: extension.price,
    to: extension.date,
    available: true,
    tooltip: "",
    label: `Forleng til ${DateService.format(extension.date, "Europe/Oslo", "DD/MM/YYYY")}`,
  })) ?? [
    {
      type: "extend",
      available: false,
      price: 0,
      tooltip: extensionStatus.feedback,
      label: "Forleng",
    },
  ];

  return [
    ...extendActions,
    {
      type: "buyout",
      price: buyoutStatus.price ?? 0,
      available: buyoutStatus.canBuyout,
      tooltip: buyoutStatus.feedback,
      label: "Kjøp ut",
    },
  ];
}
