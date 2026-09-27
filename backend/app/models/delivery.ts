import { beforeCreate } from "@adonisjs/lucid/orm";

import { assignObjectId } from "#models/helpers/object_id";
import { DeliverySchema } from "#database/schema";
import type { BringProduct, Delivery as DeliveryDto } from "#shared/delivery/delivery";
import type { DeliveryMethod } from "#shared/delivery/delivery-method/delivery-method";

/**
 * How an order reaches the customer (see `shared/delivery/delivery.ts` for the fields). An order has
 * at most one; it is deleted with its order.
 */
export default class Delivery extends DeliverySchema {
  static override selfAssignPrimaryKey = true;

  declare method: DeliveryMethod;
  declare product: BringProduct | null;

  @beforeCreate()
  static assignId(delivery: Delivery) {
    assignObjectId(delivery);
  }

  /** The delivery of the order, if it has one. */
  static async ofOrder(orderId: string): Promise<Delivery | null> {
    return this.findBy("orderId", orderId);
  }

  /** The deliveries of the given orders, keyed by order id; orders without one are absent. */
  static async byOrderIds(orderIds: Iterable<string>): Promise<Map<string, Delivery>> {
    const unique = [...new Set(orderIds)];
    if (unique.length === 0) {
      return new Map();
    }
    const deliveries = await this.query().whereIn("order_id", unique);
    return new Map(deliveries.map((delivery) => [delivery.orderId, delivery]));
  }

  /** The ids of the given orders that were shipped with Bring. */
  static async bringOrderIds(orderIds: Iterable<string>): Promise<Set<string>> {
    const unique = [...new Set(orderIds)];
    if (unique.length === 0) {
      return new Set();
    }
    const rows = await this.query()
      .whereIn("order_id", unique)
      .where("method", "bring")
      .select("order_id");
    return new Set(rows.map((delivery) => delivery.orderId));
  }

  toDto(): DeliveryDto {
    return {
      id: this.id,
      orderId: this.orderId,
      method: this.method,
      amount: this.amount,
      branchId: this.branchId,
      bringAmount: this.bringAmount,
      estimatedDelivery: this.estimatedDelivery?.toJSDate() ?? null,
      facilityAddress: this.facilityAddress,
      facilityPostalCode: this.facilityPostalCode,
      facilityPostalCity: this.facilityPostalCity,
      shipmentName: this.shipmentName,
      shipmentAddress: this.shipmentAddress,
      shipmentPostalCode: this.shipmentPostalCode,
      shipmentPostalCity: this.shipmentPostalCity,
      fromPostalCode: this.fromPostalCode,
      toPostalCode: this.toPostalCode,
      product: this.product,
      trackingNumber: this.trackingNumber,
      createdAt: this.createdAt.toJSDate(),
      updatedAt: this.updatedAt.toJSDate(),
    };
  }
}
