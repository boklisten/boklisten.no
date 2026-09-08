import type { StandCartLineContext } from "#services/stand_cart/stand_cart_line_resolver";
import type { OrderItem } from "#shared/order/order-item/order-item";
import type { OrderItemInfo } from "#shared/order/order-item/order-item-info";
import type { StandCartLine, StandCartOption } from "#shared/stand_cart";

/** A line the employee submitted, with what it resolved to and the option behind the choice. */
export interface CheckoutLine {
  line: StandCartLine;
  context: StandCartLineContext;
  option: StandCartOption;
}

function periodInfo(option: StandCartOption, now: Date): OrderItemInfo {
  return {
    from: now,
    to: new Date(option.to ?? now),
    numberOfPeriods: 1,
    ...(option.periodType ? { periodType: option.periodType } : {}),
  };
}

function withBlid(blid: string | null): Pick<OrderItem, "blid"> {
  return blid === null ? {} : { blid };
}

/** The order item that hands a copy to the customer, or records a sale either way. */
function handoutItem({ line, context, option }: CheckoutLine, now: Date): OrderItem {
  const base = {
    type: option.type,
    item: line.itemId,
    title: line.title,
    ...withBlid(line.blid),
    amount: option.price,
    unitPrice: option.price,
    delivered: false,
    ...(context.kind === "order" ? { movedFromOrder: context.order.id } : {}),
  } as const;
  switch (option.type) {
    case "rent": {
      return { ...base, type: "rent", handout: true, info: periodInfo(option, now) };
    }
    case "partly-payment": {
      return {
        ...base,
        type: "partly-payment",
        handout: true,
        info: { ...periodInfo(option, now), amountLeftToPay: option.payLater ?? 0 },
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
}: CheckoutLine & { context: { kind: "order" } }): OrderItem {
  return {
    type: "cancel",
    item: line.itemId,
    title: line.title,
    amount: option.price,
    unitPrice: option.price,
    handout: false,
    // The same shape the customer's own cancellation writes
    delivered: true,
    movedFromOrder: context.order.id,
  };
}

/** An action on a book the customer holds; the placed-order handler updates the customer item. */
function customerItemOrderItem(
  { line, context, option }: CheckoutLine & { context: { kind: "customerItem" } },
  now: Date,
): OrderItem {
  const customerItemId = context.customerItem.id;
  const base = {
    item: line.itemId,
    title: line.title,
    ...withBlid(line.blid),
    amount: option.price,
    unitPrice: option.price,
    handout: false,
    delivered: false,
    customerItem: customerItemId,
  } as const;
  switch (option.type) {
    case "return":
    case "buyback":
    case "cancel":
    case "buyout": {
      return { ...base, type: option.type };
    }
    case "extend": {
      return {
        ...base,
        type: "extend",
        info: { ...periodInfo(option, now), customerItem: customerItemId },
      };
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
export function planCheckout(lines: CheckoutLine[], now: Date): OrderItem[] {
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
