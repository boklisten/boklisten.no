import { Exception } from "@adonisjs/core/exceptions";
import db from "@adonisjs/lucid/services/db";
import { beforeCreate, beforeFetch, beforeFind, hasMany } from "@adonisjs/lucid/orm";
import type { TransactionClientContract } from "@adonisjs/lucid/types/database";
import type { ModelQueryBuilderContract } from "@adonisjs/lucid/types/model";
import type { HasMany } from "@adonisjs/lucid/types/relations";

import { assignObjectId } from "#models/helpers/object_id";
import OrderItem from "#models/order_item";
import { OrderSchema } from "#database/schema";
import type { Order as OrderDto } from "#shared/order/order";

type OrderColumns = Pick<Order, (typeof OrderSchema.$columns)[number]>;
type OrderItemColumns = Pick<OrderItem, (typeof OrderItem.$columns)[number]>;

/** The columns a new line is given; the rest take their defaults. */
export type NewOrderItem = Pick<OrderItemColumns, "type" | "itemId" | "amount" | "unitPrice"> &
  Partial<Omit<OrderItemColumns, "id" | "orderId" | "position">>;

/** The columns a new order is given, with its lines in receipt order. */
export type NewOrder = Pick<OrderColumns, "amount" | "branchId" | "customerId" | "byCustomer"> &
  Partial<Omit<OrderColumns, "createdAt" | "updatedAt">> & { orderItems: NewOrderItem[] };

/**
 * An order and its lines (see `shared/order/order.ts` for the field semantics).
 *
 * The lines are part of what an order is, so every read through this model preloads them in
 * receipt order together with each line's catalogue item (hooks below); `orderItem.title` reads the
 * current catalogue title. Create orders with `Order.createWithItems`, and after changing lines in
 * place persist them with `order.saveWithItems()`.
 */
export default class Order extends OrderSchema {
  static override selfAssignPrimaryKey = true;

  @hasMany(() => OrderItem)
  declare orderItems: HasMany<typeof OrderItem>;

  @beforeCreate()
  static assignId(order: Order) {
    assignObjectId(order);
  }

  @beforeFind()
  static preloadItemsOnFind(query: ModelQueryBuilderContract<typeof Order>) {
    Order.preloadItems(query);
  }

  @beforeFetch()
  static preloadItemsOnFetch(query: ModelQueryBuilderContract<typeof Order>) {
    Order.preloadItems(query);
  }

  static preloadItems(query: ModelQueryBuilderContract<typeof Order>) {
    void query.preload("orderItems", (orderItems) => {
      void orderItems.orderBy("position").preload("item");
    });
  }

  /** `find` for references that may be absent. */
  static async findOptional(id: string | null | undefined): Promise<Order | null> {
    return id ? this.find(id) : null;
  }

  /** `findOrFail` with the Norwegian not-found message the API shows. */
  static async getOrFail(id: string | null | undefined): Promise<Order> {
    const order = await this.findOptional(id);
    if (order === null) {
      throw new Exception(`Fant ikke ordre ${id ?? ""}`, { status: 404, code: "E_ROW_NOT_FOUND" });
    }
    return order;
  }

  /** The orders with the given ids, keyed by id; ids that do not exist are absent. */
  static async byIds(ids: Iterable<string | null | undefined>): Promise<Map<string, Order>> {
    const unique = [...new Set([...ids].filter((id): id is string => typeof id === "string"))];
    if (unique.length === 0) {
      return new Map();
    }
    const orders = await this.query().whereIn("id", unique);
    return new Map(orders.map((order) => [order.id, order]));
  }

  /** Every placed order of the customer, oldest first. */
  static async placedFor(customerId: string): Promise<Order[]> {
    return this.query()
      .where("customer_id", customerId)
      .where("placed", true)
      .orderBy("created_at");
  }

  /**
   * Inserts the order and its lines in one transaction (or inside `client` when given) and returns
   * it read back with its lines and their items loaded.
   */
  static async createWithItems(
    { orderItems, ...columns }: NewOrder,
    client?: TransactionClientContract,
  ): Promise<Order> {
    const insert = async (trx: TransactionClientContract) => {
      const order = await Order.create(columns, { client: trx });
      await order
        .related("orderItems")
        .createMany(orderItems.map((orderItem, position) => ({ ...orderItem, position })));
      return Order.query({ client: trx }).where("id", order.id).firstOrFail();
    };
    return client ? insert(client) : db.transaction(insert);
  }

  /** Saves the order and every line changed in place, in one transaction. */
  async saveWithItems(): Promise<this> {
    await db.transaction(async (trx) => {
      this.useTransaction(trx);
      await this.save();
      for (const orderItem of this.orderItems) {
        orderItem.useTransaction(trx);
        await orderItem.save();
      }
    });
    return this;
  }

  toDto(): OrderDto {
    return {
      id: this.id,
      amount: this.amount,
      branchId: this.branchId,
      customerId: this.customerId,
      byCustomer: this.byCustomer,
      employeeId: this.employeeId,
      placed: this.placed,
      notifyByEmail: this.notifyByEmail,
      checkoutState: this.checkoutState,
      createdAt: this.createdAt.toJSDate(),
      updatedAt: this.updatedAt.toJSDate(),
      orderItems: this.orderItems.map((orderItem) => orderItem.toDto()),
    };
  }
}
