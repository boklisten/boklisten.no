import { belongsTo } from "@adonisjs/lucid/orm";
import db from "@adonisjs/lucid/services/db";
import type { ChainableContract } from "@adonisjs/lucid/types/querybuilder";
import type { BelongsTo } from "@adonisjs/lucid/types/relations";

import Item from "#models/item";
import { OrderItemSchema } from "#database/schema";
import type { OrderItem as OrderItemDto } from "#shared/order/order";
import { OPEN_ORDER_ITEM_TYPES } from "#shared/order/open-order-item";
import type { OrderItemType } from "#shared/order/order-item/order-item-type";
import type { Period } from "#shared/period";

/**
 * One line of an order (see `shared/order/order.ts` for the field semantics). Lines are read
 * through `Order`, which loads them in `position` order with their catalogue item.
 */
export default class OrderItem extends OrderItemSchema {
  declare type: OrderItemType;
  declare periodType: Period | null;

  @belongsTo(() => Item)
  declare item: BelongsTo<typeof Item>;

  /**
   * Narrows a query that has `order_items` in scope to open lines, the rule of `isOpenOrderItem`
   * as SQL. `types` narrows it further, e.g. to the lines that carry a deadline.
   */
  static whereOpen<Query extends ChainableContract>(
    query: Query,
    types: readonly OrderItemType[] = OPEN_ORDER_ITEM_TYPES,
  ): Query {
    return query
      .whereIn("order_items.type", [...types])
      .where("order_items.handout", false)
      .where("order_items.delivered", false)
      .whereNull("order_items.moved_to_order_id");
  }

  /**
   * The customer's open lines on placed orders, as a query on `order_items` joined with `orders`,
   * oldest order first and in receipt order.
   */
  static openLinesOf(customerId: string, types: readonly OrderItemType[] = OPEN_ORDER_ITEM_TYPES) {
    return OrderItem.whereOpen(
      db.from("order_items").join("orders", "orders.id", "order_items.order_id"),
      types,
    )
      .where("orders.customer_id", customerId)
      .where("orders.placed", true)
      .orderBy("orders.created_at")
      .orderBy("order_items.position");
  }

  /** The book's current catalogue title; the line must have been read through `Order`. */
  get title(): string {
    const item: unknown = this.$preloaded["item"];
    if (!(item instanceof Item)) {
      throw new TypeError(`OrderItem ${this.id}: item was not loaded`);
    }
    return item.title;
  }

  toDto(): OrderItemDto {
    return {
      id: this.id,
      type: this.type,
      itemId: this.itemId,
      title: this.title,
      blid: this.blid,
      amount: this.amount,
      unitPrice: this.unitPrice,
      delivered: this.delivered,
      handout: this.handout,
      customerItemId: this.customerItemId,
      periodFrom: this.periodFrom?.toJSDate() ?? null,
      periodTo: this.periodTo?.toJSDate() ?? null,
      numberOfPeriods: this.numberOfPeriods,
      periodType: this.periodType,
      amountLeftToPay: this.amountLeftToPay,
      buybackAmount: this.buybackAmount,
      movedFromOrderId: this.movedFromOrderId,
      movedToOrderId: this.movedToOrderId,
    };
  }
}
