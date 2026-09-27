import type { DateTime } from "luxon";

import Order from "#models/order";
import type { NewOrder, NewOrderItem } from "#models/order";
import { fixtureId } from "#tests/fixtures";

let sequence = 0;

/**
 * Inserts an order and its lines into the test Postgres. The branch, the customer (unless null),
 * the employee and every line's item must exist already, since they are foreign keys. Lines default
 * to a free rent line; pass only what the test cares about.
 */
export async function createOrder(
  overrides: Partial<Omit<NewOrder, "orderItems">> &
    Pick<NewOrder, "branchId" | "customerId"> & {
      orderItems?: (Partial<NewOrderItem> & Pick<NewOrderItem, "itemId">)[];
      /** Backdates the order; Lucid only stamps the creation time when none is given. */
      createdAt?: DateTime;
    },
): Promise<Order> {
  sequence++;
  const { orderItems = [], ...columns } = overrides;
  return Order.createWithItems({
    id: fixtureId(`d${sequence.toString(16)}`),
    amount: 0,
    byCustomer: false,
    placed: true,
    ...columns,
    orderItems: orderItems.map(withLineDefaults),
  });
}

function withLineDefaults(
  orderItem: Partial<NewOrderItem> & Pick<NewOrderItem, "itemId">,
): NewOrderItem {
  return { type: "rent", amount: 0, unitPrice: 0, ...orderItem };
}
