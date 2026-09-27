import { DateTime } from "luxon";

import type { NewOrderItem } from "#models/order";
import type { StandCartLineContext } from "#services/stand_cart/stand_cart_line_resolver";
import type { StandCartLine, StandCartOption } from "#shared/stand_cart";

/** A line the employee submitted, with what it resolved to and the option behind the choice. */
export interface CheckoutLine {
  line: StandCartLine;
  context: StandCartLineContext;
  option: StandCartOption;
}

type PeriodColumns = Pick<
  NewOrderItem,
  "periodFrom" | "periodTo" | "numberOfPeriods" | "periodType"
>;

function period(option: StandCartOption, now: Date): PeriodColumns {
  return {
    periodFrom: DateTime.fromJSDate(now),
    periodTo: option.to === undefined ? DateTime.fromJSDate(now) : DateTime.fromISO(option.to),
    numberOfPeriods: 1,
    periodType: option.periodType ?? null,
  };
}

/** The order item that hands a copy to the customer, or records a sale either way. */
function handoutItem({ line, context, option }: CheckoutLine, now: Date): NewOrderItem {
  const base = {
    itemId: line.itemId,
    blid: line.blid,
    amount: option.price,
    unitPrice: option.price,
    delivered: false,
    movedFromOrderId: context.kind === "order" ? context.order.id : null,
  } as const;
  switch (option.type) {
    case "rent": {
      return { ...base, type: "rent", handout: true, ...period(option, now) };
    }
    case "partly-payment": {
      return {
        ...base,
        type: "partly-payment",
        handout: true,
        ...period(option, now),
        amountLeftToPay: option.payLater ?? 0,
      };
    }
    case "buy": {
      return { ...base, type: "buy", handout: true };
    }
    case "sell": {
      return { ...base, type: "sell", handout: false };
    }
    default: {
      throw new Error(`"${option.type}" is not a handout`);
    }
  }
}

function cancelledOrderItem({
  line,
  context,
  option,
}: CheckoutLine & { context: { kind: "order" } }): NewOrderItem {
  return {
    type: "cancel",
    itemId: line.itemId,
    amount: option.price,
    unitPrice: option.price,
    handout: false,
    // The same shape the customer's own cancellation writes
    delivered: true,
    movedFromOrderId: context.order.id,
  };
}

/** An action on a book the customer holds; the placed-order handler updates the customer item. */
function customerItemOrderItem(
  { line, context, option }: CheckoutLine & { context: { kind: "customerItem" } },
  now: Date,
): NewOrderItem {
  const base = {
    itemId: line.itemId,
    blid: line.blid,
    amount: option.price,
    unitPrice: option.price,
    handout: false,
    delivered: false,
    customerItemId: context.customerItem.id,
  } as const;
  switch (option.type) {
    case "return":
    case "buyback":
    case "cancel":
    case "buyout": {
      return { ...base, type: option.type };
    }
    case "extend": {
      return { ...base, type: "extend", ...period(option, now) };
    }
    default: {
      throw new Error(`"${option.type}" cannot be done to a held book`);
    }
  }
}

/**
 * Turns the submitted lines into the order items of one order. Pure: prices come from the
 * options, which the resolver already settled.
 */
export function planCheckout(lines: CheckoutLine[], now: Date): NewOrderItem[] {
  return lines.map((checkoutLine) => {
    const { context, option } = checkoutLine;
    switch (context.kind) {
      case "order": {
        const orderLine = { ...checkoutLine, context };
        return option.type === "cancel"
          ? cancelledOrderItem(orderLine)
          : handoutItem(checkoutLine, now);
      }
      case "customerItem": {
        return customerItemOrderItem({ ...checkoutLine, context }, now);
      }
      case "item": {
        return handoutItem(checkoutLine, now);
      }
      default: {
        throw new Error(`unknown line context ${JSON.stringify(context)}`);
      }
    }
  });
}
