import { ObjectId } from "mongodb";

import { SEDbQuery } from "#models/mongoose/storage/db-query";
import { StorageService } from "#services/storage_service";
import type { Payment } from "#shared/payment/payment";

/**
 * The payments recorded for orders, found through `payments.order` (indexed). Orders no longer
 * list their payments; every writer records a payment with its order id, so this is the same set
 * the dropped `orders.payments` array held. Oldest first, the order they were recorded in.
 */
export const OrderPayments = {
  async of(orderId: string): Promise<Payment[]> {
    return (await OrderPayments.byOrder([orderId])).get(orderId) ?? [];
  },

  /** The payments of each order, keyed by order id; orders without payments are absent. */
  async byOrder(orderIds: Iterable<string>): Promise<Map<string, Payment[]>> {
    const ids = [...new Set(orderIds)];
    const byOrder = new Map<string, Payment[]>();
    if (ids.length === 0) {
      return byOrder;
    }
    const query = new SEDbQuery();
    query.objectIdFilters = [{ fieldName: "order", value: ids.map((id) => new ObjectId(id)) }];
    query.sortFilters = [{ fieldName: "creationTime", direction: 1 }];
    for (const payment of (await StorageService.Payments.getByQueryOrNull(query)) ?? []) {
      const orderId = String(payment.order);
      byOrder.set(orderId, [...(byOrder.get(orderId) ?? []), payment]);
    }
    return byOrder;
  },

  /** Whether any payment is recorded for the order (confirmed or not). */
  async exist(orderId: string): Promise<boolean> {
    return (await OrderPayments.of(orderId)).length > 0;
  },
};
