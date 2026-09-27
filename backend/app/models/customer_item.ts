import db from "@adonisjs/lucid/services/db";
import { beforeCreate, beforeFetch, beforeFind, belongsTo, hasMany } from "@adonisjs/lucid/orm";
import type { ModelQueryBuilderContract } from "@adonisjs/lucid/types/model";
import type { ChainableContract } from "@adonisjs/lucid/types/querybuilder";
import type { BelongsTo, HasMany } from "@adonisjs/lucid/types/relations";

import Branch from "#models/branch";
import CustomerItemPeriodExtend from "#models/customer_item_period_extend";
import { assignObjectId, distinctIds } from "#models/helpers/object_id";
import Item from "#models/item";
import { CustomerItemSchema } from "#database/schema";
import type { CustomerItem as CustomerItemDto } from "#shared/customer-item/customer-item";
import type { CustomerItemType } from "#shared/customer-item/customer-item-type";
import type { OrderItemType } from "#shared/order/order-item/order-item-type";
import type { Period } from "#shared/period";

/** Order lines that put a book in the customer's hands or moved its deadline. */
const PERIOD_LINE_TYPES: OrderItemType[] = ["rent", "partly-payment", "match-receive", "extend"];

/** The newest line that set a customer item's period. */
export interface CustomerItemPeriodLine {
  orderId: string;
  periodType: Period | null;
}

function linesNaming(ids: Iterable<string>) {
  return db
    .from("order_items")
    .join("orders", "orders.id", "order_items.order_id")
    .whereIn("order_items.customer_item_id", [...new Set(ids)]);
}

/**
 * A book a customer holds or has held: a rental or a partly-paid purchase, from handout until it is
 * returned, bought out, cancelled or bought back.
 *
 * Every read through this model preloads its deadline extensions oldest first (hooks below). The
 * orders behind a customer item are the order lines whose `customer_item_id` names it; see
 * `orderIdsOf` and `lastPeriodLinesOf`.
 */
export default class CustomerItem extends CustomerItemSchema {
  static override selfAssignPrimaryKey = true;

  declare type: CustomerItemType;

  @belongsTo(() => Item)
  declare item: BelongsTo<typeof Item>;

  @belongsTo(() => Branch, { foreignKey: "handoutBranchId" })
  declare handoutBranch: BelongsTo<typeof Branch>;

  @hasMany(() => CustomerItemPeriodExtend)
  declare periodExtends: HasMany<typeof CustomerItemPeriodExtend>;

  @beforeCreate()
  static assignId(customerItem: CustomerItem) {
    assignObjectId(customerItem);
  }

  @beforeFind()
  static preloadExtendsOnFind(query: ModelQueryBuilderContract<typeof CustomerItem>) {
    CustomerItem.preloadExtends(query);
  }

  @beforeFetch()
  static preloadExtendsOnFetch(query: ModelQueryBuilderContract<typeof CustomerItem>) {
    CustomerItem.preloadExtends(query);
  }

  static preloadExtends(query: ModelQueryBuilderContract<typeof CustomerItem>) {
    void query.preload("periodExtends", (periodExtends) => {
      void periodExtends.orderBy("created_at").orderBy("id");
    });
  }

  /**
   * Narrows a query that has `customer_items` in scope to books still out with a customer: not
   * returned, bought out, cancelled or bought back.
   */
  static whereActive<Query extends ChainableContract>(query: Query): Query {
    return query
      .where("customer_items.returned", false)
      .where("customer_items.buyout", false)
      .where("customer_items.cancel", false)
      .where("customer_items.buyback", false);
  }

  /** The customer items with the given ids, in no particular order; missing ids are left out. */
  static async findByIds(ids: Iterable<string | null | undefined>): Promise<CustomerItem[]> {
    const unique = distinctIds(ids);
    if (unique.length === 0) {
      return [];
    }
    return this.query().whereIn("id", unique);
  }

  /** The active customer items carrying this blid (normally at most one). */
  static async activeByBlid(blid: string): Promise<CustomerItem[]> {
    return CustomerItem.whereActive(this.query().where("blid", blid));
  }

  /** The customer's active customer items, by deadline. */
  static async activeFor(customerId: string): Promise<CustomerItem[]> {
    return CustomerItem.whereActive(this.query().where("customer_id", customerId)).orderBy(
      "deadline",
    );
  }

  /** The customer's active copy of the title, if they hold one. */
  static async activeForItem(customerId: string, itemId: string): Promise<CustomerItem | null> {
    return CustomerItem.whereActive(
      this.query().where("customer_id", customerId).where("item_id", itemId),
    ).first();
  }

  /** Whether the customer holds any active customer item. */
  static async hasActive(customerId: string): Promise<boolean> {
    const row = await CustomerItem.whereActive(
      db.from("customer_items").where("customer_id", customerId),
    )
      .select("id")
      .first();
    return row !== null;
  }

  /** The orders whose lines name each of the customer items, oldest first. */
  static async orderIdsOf(ids: Iterable<string>): Promise<Map<string, string[]>> {
    const rows: { customerItemId: string; orderId: string }[] = await linesNaming(ids)
      .groupBy("order_items.customer_item_id", "order_items.order_id", "orders.created_at")
      .orderBy("orders.created_at")
      .orderBy("order_items.order_id")
      .select("order_items.customer_item_id as customerItemId", "order_items.order_id as orderId");
    const byCustomerItem = new Map<string, string[]>();
    for (const { customerItemId, orderId } of rows) {
      byCustomerItem.set(customerItemId, [...(byCustomerItem.get(customerItemId) ?? []), orderId]);
    }
    return byCustomerItem;
  }

  /**
   * The newest order line that set each customer item's period (handout, match handout or
   * extension): the order whose period type prices a buyout, and the one an invoice refers to.
   */
  static async lastPeriodLinesOf(
    ids: Iterable<string>,
  ): Promise<Map<string, CustomerItemPeriodLine>> {
    const rows: (CustomerItemPeriodLine & { customerItemId: string })[] = await linesNaming(ids)
      .whereIn("order_items.type", PERIOD_LINE_TYPES)
      .distinctOn("order_items.customer_item_id")
      .orderBy("order_items.customer_item_id")
      .orderBy("orders.created_at", "desc")
      .orderBy("order_items.order_id", "desc")
      .orderBy("order_items.position", "desc")
      .select(
        "order_items.customer_item_id as customerItemId",
        "order_items.order_id as orderId",
        "order_items.period_type as periodType",
      );
    return new Map(rows.map(({ customerItemId, ...line }) => [customerItemId, line]));
  }

  /** Not returned, bought out, cancelled or bought back. */
  get isActive(): boolean {
    return !(this.returned || this.buyout || this.cancel || this.buyback);
  }

  toDto(): CustomerItemDto {
    return {
      id: this.id,
      itemId: this.itemId,
      blid: this.blid,
      type: this.type,
      customerId: this.customerId,
      deadline: this.deadline.toJSDate(),
      handoutBranchId: this.handoutBranchId,
      handoutEmployeeId: this.handoutEmployeeId,
      handedOutAt: this.handedOutAt.toJSDate(),
      returned: this.returned,
      returnBranchId: this.returnBranchId,
      returnEmployeeId: this.returnEmployeeId,
      returnedAt: this.returnedAt?.toJSDate() ?? null,
      buyout: this.buyout,
      buyoutOrderId: this.buyoutOrderId,
      boughtOutAt: this.boughtOutAt?.toJSDate() ?? null,
      cancel: this.cancel,
      cancelOrderId: this.cancelOrderId,
      cancelledAt: this.cancelledAt?.toJSDate() ?? null,
      buyback: this.buyback,
      buybackOrderId: this.buybackOrderId,
      boughtBackAt: this.boughtBackAt?.toJSDate() ?? null,
      amountLeftToPay: this.amountLeftToPay,
      periodExtends: this.periodExtends.map((periodExtend) => ({
        periodFrom: periodExtend.periodFrom.toJSDate(),
        periodTo: periodExtend.periodTo.toJSDate(),
        periodType: periodExtend.periodType,
        createdAt: periodExtend.createdAt.toJSDate(),
      })),
      createdAt: this.createdAt.toJSDate(),
      updatedAt: this.updatedAt.toJSDate(),
    };
  }
}
