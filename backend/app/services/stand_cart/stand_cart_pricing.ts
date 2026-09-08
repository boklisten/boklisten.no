import { DateTime } from "luxon";

import {
  availableExtendPeriods,
  isDeadlineWithGracePeriodExpired,
  resolveBuyoutPrice,
} from "#services/customer_item_actions_service";
import { HeldBookRules } from "#services/stand_cart/stand_cart_rules";
import type { Branch } from "#shared/branch";
import type { BranchItem } from "#shared/branch-item";
import type { BranchPaymentInfo } from "#shared/branch-payment-info";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Item } from "#shared/item";
import type { Order } from "#shared/order/order";
import type { OrderItem } from "#shared/order/order-item/order-item";
import type { Period } from "#shared/period";
import { futureRentPeriods } from "#shared/rent-periods";
import { findOption } from "#shared/stand_cart";
import type { StandCartActionType, StandCartOption } from "#shared/stand_cart";

/**
 * The priced part of a cart line: what the employee may pick and what it costs. Pure, so every
 * price rule of the stand is covered by specs without a database.
 */
export interface PricedLine {
  options: StandCartOption[];
  defaultOptionIndex: number;
  /** Why there are no options; only an item line can come up empty. */
  unavailableReason: string | null;
}

const MATCH_BLOCKS_CANCEL_REASON =
  "Boka er en del av en overlevering med en annen elev og kan ikke avbestilles";

type PartlyPaymentPeriod = NonNullable<BranchPaymentInfo["partlyPaymentPeriods"]>[number];

/** Stand prices are whole tens of kroner, rounded down, the way the web store shows them. */
function roundDownToTen(amount: number): number {
  return Math.floor(amount / 10) * 10;
}

/** Money going back to the customer, without the `-0` a unary minus leaves on zero. */
function refund(amount: number): number {
  return 0 - amount;
}

function customerPays(branch: Branch): boolean {
  return !branch.paymentInfo?.responsible;
}

function rentPrice(branch: Branch, item: Item, percentage: number): number {
  return customerPays(branch) ? Math.ceil(item.price * percentage) : 0;
}

function partlyPaymentPrices(
  branch: Branch,
  item: Item,
  period: PartlyPaymentPeriod,
): { price: number; payLater: number } {
  if (!customerPays(branch)) {
    return { price: 0, payLater: 0 };
  }
  return {
    price: roundDownToTen(item.price * period.percentageUpFront),
    payLater: roundDownToTen(item.price * period.percentageBuyout),
  };
}

function buyPrice(branch: Branch, item: Item): number {
  return customerPays(branch) ? roundDownToTen(item.price) : 0;
}

function futurePartlyPaymentPeriods(branch: Branch, now: Date): PartlyPaymentPeriod[] {
  return (branch.paymentInfo?.partlyPaymentPeriods ?? [])
    .filter((period) => new Date(period.date).getTime() > now.getTime())
    .toSorted((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function iso(date: Date): string {
  return new Date(date).toISOString();
}

function option(
  type: StandCartActionType,
  price: number,
  extra: Partial<StandCartOption> = {},
): StandCartOption {
  return { type, price, available: true, monitored: false, ...extra };
}

function monitoredWhen(reason: string | null): Partial<StandCartOption> {
  return reason === null ? {} : { monitored: true, reason };
}

/** The type an open order item can have; anything else is never offered as a line. */
function orderedActionType(orderItem: OrderItem): StandCartActionType | null {
  return orderItem.type === "rent" ||
    orderItem.type === "partly-payment" ||
    orderItem.type === "buy"
    ? orderItem.type
    : null;
}

/** What the customer paid for this book on the original order; nothing when it was never paid. */
export function alreadyPaidFor(order: Order, orderItem: OrderItem): number {
  return order.payments.length > 0 ? orderItem.amount : 0;
}

/** The handout options a branch offers a copy of this item, priced from the cart branch. */
function handoutOptions({
  branch,
  item,
  branchItem,
  alwaysAllow,
  alreadyPaid,
  now,
}: {
  branch: Branch;
  item: Item;
  branchItem: BranchItem | null;
  /** The type the customer ordered is offered whatever the branch item says. */
  alwaysAllow: StandCartActionType | null;
  alreadyPaid: number;
  now: Date;
}): StandCartOption[] {
  // A branch without an entry for the book still lends it: that is what happens when a book
  // nobody ordered is scanned at the stand today.
  const allows = (type: StandCartActionType, flag: boolean | undefined) =>
    type === alwaysAllow || (branchItem ? flag === true : type === "rent");
  const options: StandCartOption[] = [];

  if (allows("rent", branchItem?.rentAtBranch)) {
    for (const period of futureRentPeriods(branch, now)) {
      options.push(
        option("rent", rentPrice(branch, item, period.percentage) - alreadyPaid, {
          to: iso(period.date),
          periodType: period.type,
        }),
      );
    }
  }
  if (allows("partly-payment", branchItem?.partlyPaymentAtBranch)) {
    for (const period of futurePartlyPaymentPeriods(branch, now)) {
      const { price, payLater } = partlyPaymentPrices(branch, item, period);
      options.push(
        option("partly-payment", price - alreadyPaid, {
          to: iso(period.date),
          periodType: period.type,
          payLater,
        }),
      );
    }
  }
  if (allows("buy", branchItem?.buyAtBranch)) {
    options.push(option("buy", buyPrice(branch, item) - alreadyPaid));
  }
  return options;
}

function indexOfType(options: StandCartOption[], type: StandCartActionType): number {
  const index = options.findIndex((candidate) => candidate.type === type);
  return index === -1 ? 0 : index;
}

/** The option the customer ordered: same type and period end, else the first of the type. */
function indexOfOrderedOption(options: StandCartOption[], orderItem: OrderItem): number {
  const type = orderedActionType(orderItem);
  const orderedTo = orderItem.info?.to;
  const ordered =
    type !== null && orderedTo !== undefined
      ? findOption({ options }, { type, to: iso(orderedTo) })
      : null;
  const index = ordered
    ? options.indexOf(ordered)
    : options.findIndex((candidate) => candidate.type === type);
  return index === -1 ? 0 : index;
}

export function priceOrderLine({
  branch,
  item,
  branchItem,
  originalOrder,
  originalOrderItem,
  blockedByMatch,
  scanned,
  now,
}: {
  branch: Branch;
  item: Item;
  branchItem: BranchItem | null;
  originalOrder: Order;
  originalOrderItem: OrderItem;
  /** A user match in an active round depends on this book, so it may not be cancelled. */
  blockedByMatch: boolean;
  /** A copy is in hand. Without one the order can only be cancelled, never handed out. */
  scanned: boolean;
  now: Date;
}): PricedLine {
  const alreadyPaid = alreadyPaidFor(originalOrder, originalOrderItem);
  const options = [
    ...(scanned
      ? handoutOptions({
          branch,
          item,
          branchItem,
          alwaysAllow: orderedActionType(originalOrderItem),
          alreadyPaid,
          now,
        })
      : []),
    option("cancel", refund(alreadyPaid), {
      available: !blockedByMatch,
      ...(blockedByMatch ? { reason: MATCH_BLOCKS_CANCEL_REASON } : {}),
    }),
  ];
  return {
    options,
    defaultOptionIndex: scanned
      ? indexOfOrderedOption(options, originalOrderItem)
      : indexOfType(options, "cancel"),
    unavailableReason: null,
  };
}

/**
 * Extending is offered exactly as the customer could do it themselves: the handout branch's
 * periods after the deadline, within the cap and the grace period. The extension is recorded on
 * the cart branch, whose period types the placed-order handler looks up, so a period type the
 * cart branch lacks is left out too. Outside that it is simply not there.
 */
function extendOptions(
  customerItem: CustomerItem,
  handoutBranch: Branch | null,
  branch: Branch,
  now: DateTime,
): StandCartOption[] {
  if (!handoutBranch || isDeadlineWithGracePeriodExpired(customerItem, now)) {
    return [];
  }
  const recordable = new Set(
    (branch.paymentInfo?.extendPeriods ?? []).map((period) => period.type),
  );
  return availableExtendPeriods(customerItem, handoutBranch, now.toJSDate())
    .filter((period) => recordable.has(period.type))
    .map((period) =>
      option("extend", period.price, { to: iso(period.date), periodType: period.type }),
    );
}

/** Buying out is always allowed at the stand; outside the rules it is reported, not blocked. */
function buyoutOption(
  customerItem: CustomerItem,
  item: Item,
  handoutBranch: Branch | null,
  periodType: Period | undefined,
  now: DateTime,
): StandCartOption {
  const price = resolveBuyoutPrice({ customerItem, item, branch: handoutBranch, periodType });
  if (price === null) {
    return option("buyout", 0, { available: false, reason: "Klarte ikke beregne utkjøpspris" });
  }
  return option("buyout", price, monitoredWhen(HeldBookRules.buyout(customerItem, now)));
}

export function priceCustomerItemLine({
  branch,
  handoutBranch,
  item,
  customerItem,
  paidAmount,
  periodType,
  now,
}: {
  /** The cart branch the order is recorded on; an extension must be a period type it has. */
  branch: Branch;
  /** The branch the book was handed out from; prices extend and buyout as the customer sees them. */
  handoutBranch: Branch | null;
  item: Item;
  customerItem: CustomerItem;
  /** What the customer paid to get the book, refunded on cancel. */
  paidAmount: number;
  /** The period type of the handout order, for the partly-payment buyout percentage. */
  periodType: Period | undefined;
  now: Date;
}): PricedLine {
  const at = DateTime.fromJSDate(now);
  const backType = customerItem.type === "partly-payment" ? "buyback" : "return";
  return {
    options: [
      option(backType, 0, monitoredWhen(HeldBookRules.takeBack(customerItem, now))),
      option("cancel", refund(paidAmount), monitoredWhen(HeldBookRules.cancel(customerItem, at))),
      ...extendOptions(customerItem, handoutBranch, branch, at),
      buyoutOption(customerItem, item, handoutBranch, periodType, at),
    ],
    defaultOptionIndex: 0,
    unavailableReason: null,
  };
}

export function priceItemLine({
  branch,
  item,
  branchItem,
  now,
}: {
  branch: Branch;
  item: Item;
  branchItem: BranchItem | null;
  now: Date;
}): PricedLine {
  const options = handoutOptions({
    branch,
    item,
    branchItem,
    alwaysAllow: null,
    alreadyPaid: 0,
    now,
  });
  const sellPercentage = branch.paymentInfo?.sell?.percentage;
  if (item.buyback && sellPercentage) {
    options.push(option("sell", refund(roundDownToTen(item.price * sellPercentage))));
  }
  return {
    options,
    defaultOptionIndex: 0,
    unavailableReason: options.length === 0 ? nothingOfferedReason(branch, branchItem) : null,
  };
}

/**
 * Why a scanned copy cannot go out from this branch. Without a branch item the book is not on
 * the branch's list, and the fallback rent needs a period the branch does not have; with one,
 * every flagged action came up without a period or a price.
 */
function nothingOfferedReason(branch: Branch, branchItem: BranchItem | null): string {
  return branchItem
    ? `${branch.name} har ingen gyldig periode eller pris for denne boka`
    : `Boka står ikke i boklisten til ${branch.name}`;
}
