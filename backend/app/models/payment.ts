import { beforeCreate } from "@adonisjs/lucid/orm";

import { assignObjectId } from "#models/helpers/object_id";
import { PaymentSchema } from "#database/schema";
import type { Payment as PaymentDto } from "#shared/payment/payment";
import type { PaymentMethod } from "#shared/payment/payment-method/payment-method";

/**
 * Money recorded against an order: what the customer paid, or, with a negative amount, what was
 * refunded (see `shared/payment/payment.ts`). A payment is part of its order and is deleted with
 * it. It is recorded unconfirmed and confirmed when the order is placed.
 */
export default class Payment extends PaymentSchema {
  static override selfAssignPrimaryKey = true;

  declare method: PaymentMethod;

  @beforeCreate()
  static assignId(payment: Payment) {
    assignObjectId(payment);
  }

  /** The payments of the order, in the order they were recorded. */
  static async ofOrder(orderId: string): Promise<Payment[]> {
    return this.query().where("order_id", orderId).orderBy("created_at").orderBy("id");
  }

  /** The payments of each order, keyed by order id; orders without payments are absent. */
  static async byOrderIds(orderIds: Iterable<string>): Promise<Map<string, Payment[]>> {
    const unique = [...new Set(orderIds)];
    if (unique.length === 0) {
      return new Map();
    }
    const payments = await this.query()
      .whereIn("order_id", unique)
      .orderBy("created_at")
      .orderBy("id");
    return Map.groupBy(payments, (payment) => payment.orderId);
  }

  /** Whether any payment is recorded for the order, confirmed or not. */
  static async existFor(orderId: string): Promise<boolean> {
    return (await this.query().where("order_id", orderId).first()) !== null;
  }

  toDto(): PaymentDto {
    return {
      id: this.id,
      orderId: this.orderId,
      method: this.method,
      amount: this.amount,
      confirmed: this.confirmed,
      createdAt: this.createdAt.toJSDate(),
      updatedAt: this.updatedAt.toJSDate(),
    };
  }
}
