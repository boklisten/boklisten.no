import { BaseSchema } from "@adonisjs/lucid/schema";
import type { QueryClientContract } from "@adonisjs/lucid/types/database";
import type { Document } from "mongodb";

import {
  assertRowCount,
  dropCollection,
  hexId,
  requiredHexId,
  skip,
  timestampsOf,
  transferCollection,
  withMongo,
} from "#database/helpers/mongo_transfer";
import type { MapResult, Row } from "#database/helpers/mongo_transfer";
import env from "#start/env";

/**
 * Step 9 of `docs/postgres-migration-plan.md`: customer items move from MongoDB to Postgres, keeping
 * their Mongo ids, and the embedded `periodExtends` array becomes `customer_item_period_extends`.
 *
 * Schema fixes made on the way, backed by the staging survey recorded in the plan:
 * - `handoutInfo`, `returnInfo`, `cancelInfo`, `buyoutInfo` and `buybackInfo` become columns.
 *   `handout` is dropped: it was true on every document and every writer sets it, and the handout
 *   branch and time it guarded are always present.
 * - `orders` is dropped: `order_items.customer_item_id` names the same orders (and more: returns,
 *   invoice payments and match deliveries were never appended to the array). Where the array names
 *   an order whose lines do not point back, the one line of that order with the same item and no
 *   customer item is linked (almost all are match handouts); entries that cannot be resolved that
 *   way, or that name deleted orders, are logged and dropped. After the transfer the column gets
 *   its foreign key, and lines naming customer items that do not exist are unlinked first.
 * - The `customerInfo` snapshot, the meta fields `user`, `editableFor`, `viewableFor`, `active`
 *   (false on six returned 2019 documents nothing reads) and the 24 stray `comment` tags are dropped.
 *
 * Orphans, decided in the plan's step 9 section: customers and employees deleted by the old
 * three-year user cleanup become NULL (the book history outlives them); cancel/buyout/buyback
 * references to deleted orders become NULL; the four customer items naming the book deleted from
 * the catalogue are left behind.
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("customer_items", (table) => {
      table.string("id", 24).primary();
      // RESTRICT: a title with loans cannot be deleted from the catalogue.
      table
        .string("item_id", 24)
        .notNullable()
        .references("id")
        .inTable("items")
        .onDelete("RESTRICT");
      table.enu("type", ["rent", "partly-payment"]).notNullable();
      table.text("blid").nullable();
      // SET NULL: the book's history outlives a deleted customer.
      table
        .string("customer_id", 24)
        .nullable()
        .references("id")
        .inTable("users")
        .onDelete("SET NULL");
      table.timestamp("deadline").notNullable();

      // RESTRICT: a branch that handed out books is never deleted.
      table
        .string("handout_branch_id", 24)
        .notNullable()
        .references("id")
        .inTable("branches")
        .onDelete("RESTRICT");
      // SET NULL: the employee is an optional back-reference.
      table
        .string("handout_employee_id", 24)
        .nullable()
        .references("id")
        .inTable("users")
        .onDelete("SET NULL");
      table.timestamp("handed_out_at").notNullable();

      table.boolean("returned").notNullable().defaultTo(false);
      table
        .string("return_branch_id", 24)
        .nullable()
        .references("id")
        .inTable("branches")
        .onDelete("RESTRICT");
      table
        .string("return_employee_id", 24)
        .nullable()
        .references("id")
        .inTable("users")
        .onDelete("SET NULL");
      table.timestamp("returned_at").nullable();

      // SET NULL on the order references: the customer item's state outlives the order record.
      table.boolean("cancel").notNullable().defaultTo(false);
      table
        .string("cancel_order_id", 24)
        .nullable()
        .references("id")
        .inTable("orders")
        .onDelete("SET NULL");
      table.timestamp("cancelled_at").nullable();

      table.boolean("buyout").notNullable().defaultTo(false);
      table
        .string("buyout_order_id", 24)
        .nullable()
        .references("id")
        .inTable("orders")
        .onDelete("SET NULL");
      table.timestamp("bought_out_at").nullable();

      table.boolean("buyback").notNullable().defaultTo(false);
      table
        .string("buyback_order_id", 24)
        .nullable()
        .references("id")
        .inTable("orders")
        .onDelete("SET NULL");
      table.timestamp("bought_back_at").nullable();

      // Partly payment: what the customer still owes when buying the book out.
      table.integer("amount_left_to_pay").nullable();

      table.timestamp("created_at").notNullable();
      table.timestamp("updated_at").notNullable();

      table.index(["customer_id"]);
      table.index(["blid"]);
      table.index(["item_id"]);
      table.index(["handout_branch_id"]);
    });
    // One active loan per blid, as Mongo's `unique_active_blid` partial index enforced.
    this.schema.raw(
      "CREATE UNIQUE INDEX customer_items_unique_active_blid ON customer_items (blid) WHERE blid IS NOT NULL AND NOT returned AND NOT buyout",
    );
    // Reminders and the stand walk the books still out, by deadline.
    this.schema.raw(
      "CREATE INDEX customer_items_open_deadline_index ON customer_items (deadline) WHERE NOT returned AND NOT buyout AND NOT cancel AND NOT buyback",
    );

    this.schema.createTable("customer_item_period_extends", (table) => {
      table.increments("id");
      // CASCADE: an extension is part of its customer item.
      table
        .string("customer_item_id", 24)
        .notNullable()
        .references("id")
        .inTable("customer_items")
        .onDelete("CASCADE");
      table.timestamp("period_from").notNullable();
      table.timestamp("period_to").notNullable();
      table.enu("period_type", ["semester", "year"]).notNullable();
      table.timestamp("created_at").notNullable();

      table.index(["customer_item_id"]);
    });

    this.defer(async (database) => {
      if (env.get("API_ENV") === "test") {
        return;
      }
      const ids = async (table: string) =>
        new Set<string>(
          (await database.from(table).select("id")).map((row: { id: string }) => row.id),
        );
      const context: MapContext = {
        catalogue: await ids("items"),
        users: await ids("users"),
        orders: await ids("orders"),
        lines: await linesByOrder(database),
        links: new Map(),
        stats: {
          customerDeleted: 0,
          handoutEmployeeDeleted: 0,
          returnEmployeeDeleted: 0,
          stateOrderMissing: 0,
          ordersLinked: 0,
          ordersAlreadyLinked: 0,
          ordersUnresolved: 0,
          ordersDeleted: 0,
        },
      };
      await withMongo(async (mongo) => {
        const { migrated } = await transferCollection({
          mongo,
          database,
          collection: "customeritems",
          table: "customer_items",
          map: (document) => mapCustomerItem(document, context),
        });
        const { stats } = context;
        console.log(
          `customer_items: ${stats.customerDeleted} deleted customers, ${stats.handoutEmployeeDeleted} deleted handout employees and ` +
            `${stats.returnEmployeeDeleted} deleted return employees set to null, ${stats.stateOrderMissing} cancel/buyout/buyback references to missing orders set to null; ` +
            `orders array: ${stats.ordersAlreadyLinked} already linked, ${stats.ordersLinked} lines linked, ` +
            `${stats.ordersUnresolved} unresolved and ${stats.ordersDeleted} naming deleted orders dropped`,
        );
        await assertRowCount(database, "customer_items", migrated);

        await linkOrderItems(database, context.links);
        const orphanedLines = database
          .from("order_items")
          .whereNotNull("customer_item_id")
          .whereNotIn("customer_item_id", database.from("customer_items").select("id"));
        const [orphans] = await orphanedLines.clone().count("* as total");
        await orphanedLines.update({ customer_item_id: null });
        console.log(
          `order_items: ${Number(orphans?.total ?? 0)} references to missing customer items set to null`,
        );

        await dropCollection(mongo, "customeritems");
      });
    });

    this.schema.alterTable("order_items", (table) => {
      // SET NULL: the order line is accounting history and outlives the customer item.
      table
        .foreign("customer_item_id")
        .references("id")
        .inTable("customer_items")
        .onDelete("SET NULL");
    });
  }

  override async down() {
    this.schema.alterTable("order_items", (table) => {
      table.dropForeign(["customer_item_id"]);
    });
    this.schema.dropTable("customer_item_period_extends");
    this.schema.dropTable("customer_items");
  }
}

interface Line {
  id: number;
  itemId: string;
  customerItemId: string | null;
}

interface MapContext {
  catalogue: Set<string>;
  users: Set<string>;
  orders: Set<string>;
  /** Every order line, by order id; `customerItemId` is updated as lines get linked. */
  lines: Map<string, Line[]>;
  /** Order line id → customer item id to write once the customer items exist. */
  links: Map<number, string>;
  stats: {
    customerDeleted: number;
    handoutEmployeeDeleted: number;
    returnEmployeeDeleted: number;
    stateOrderMissing: number;
    ordersLinked: number;
    ordersAlreadyLinked: number;
    ordersUnresolved: number;
    ordersDeleted: number;
  };
}

async function linesByOrder(database: QueryClientContract): Promise<Map<string, Line[]>> {
  const rows: { id: number; order_id: string; item_id: string; customer_item_id: string | null }[] =
    await database.from("order_items").select("id", "order_id", "item_id", "customer_item_id");
  const lines = new Map<string, Line[]>();
  for (const row of rows) {
    let ofOrder = lines.get(row.order_id);
    if (ofOrder === undefined) {
      ofOrder = [];
      lines.set(row.order_id, ofOrder);
    }
    ofOrder.push({ id: row.id, itemId: row.item_id, customerItemId: row.customer_item_id });
  }
  return lines;
}

function mapCustomerItem(document: Document, context: MapContext): MapResult {
  const id = requiredHexId(document["_id"], "customeritems._id");
  const itemId = requiredHexId(document["item"], `customeritems.${id}.item`);
  if (!context.catalogue.has(itemId)) {
    console.log(`customeritems.${id}: item ${itemId} is no longer in the catalogue, dropped`);
    return skip("item no longer in the catalogue");
  }
  resolveOrders(id, itemId, document["orders"], context);

  const handoutInfo = recordOf(document["handoutInfo"]);
  const returnInfo = recordOf(document["returnInfo"]);
  const cancelInfo = recordOf(document["cancelInfo"]);
  const buyoutInfo = recordOf(document["buyoutInfo"]);
  const buybackInfo = recordOf(document["buybackInfo"]);
  const periodExtends: unknown[] = Array.isArray(document["periodExtends"])
    ? document["periodExtends"]
    : [];

  return {
    row: {
      id,
      item_id: itemId,
      type: document["type"],
      blid: typeof document["blid"] === "string" ? document["blid"] : null,
      customer_id: existingUser(document["customer"], context, "customerDeleted"),
      deadline: requiredDate(document["deadline"], `customeritems.${id}.deadline`),
      handout_branch_id: requiredHexId(
        handoutInfo["handoutById"],
        `customeritems.${id}.handoutInfo.handoutById`,
      ),
      handout_employee_id: existingUser(
        handoutInfo["handoutEmployee"],
        context,
        "handoutEmployeeDeleted",
      ),
      handed_out_at: requiredDate(handoutInfo["time"], `customeritems.${id}.handoutInfo.time`),
      returned: document["returned"] === true,
      return_branch_id: hexId(returnInfo["returnedToId"]),
      return_employee_id: existingUser(
        returnInfo["returnEmployee"],
        context,
        "returnEmployeeDeleted",
      ),
      returned_at: dateOrNull(returnInfo["time"]),
      cancel: document["cancel"] === true,
      cancel_order_id: existingOrder(cancelInfo["order"], context),
      cancelled_at: dateOrNull(cancelInfo["time"]),
      buyout: document["buyout"] === true,
      buyout_order_id: existingOrder(buyoutInfo["order"], context),
      bought_out_at: dateOrNull(buyoutInfo["time"]),
      buyback: document["buyback"] === true,
      buyback_order_id: existingOrder(buybackInfo["order"], context),
      bought_back_at: dateOrNull(buybackInfo["time"]),
      amount_left_to_pay:
        typeof document["amountLeftToPay"] === "number" ? document["amountLeftToPay"] : null,
      ...timestampsOf(document),
    },
    children: {
      customer_item_period_extends: periodExtends.map((value, index): Row => {
        const extend = recordOf(value);
        const field = `customeritems.${id}.periodExtends.${index}`;
        return {
          customer_item_id: id,
          period_from: requiredDate(extend["from"], `${field}.from`),
          period_to: requiredDate(extend["to"], `${field}.to`),
          period_type: extend["periodType"],
          created_at: requiredDate(extend["time"], `${field}.time`),
        };
      }),
    },
  };
}

/**
 * Checks every order the customer item's `orders` array names against the order lines that point
 * back at it, and queues a link for the one unlinked same-item line where that resolves it.
 */
function resolveOrders(id: string, itemId: string, value: unknown, context: MapContext) {
  const orderIds = Array.isArray(value) ? value.map((orderId) => hexId(orderId)) : [];
  for (const orderId of orderIds) {
    if (orderId === null || !context.orders.has(orderId)) {
      context.stats.ordersDeleted++;
      continue;
    }
    const lines = context.lines.get(orderId) ?? [];
    if (lines.some((line) => line.customerItemId === id)) {
      context.stats.ordersAlreadyLinked++;
      continue;
    }
    const free = lines.filter((line) => line.itemId === itemId && line.customerItemId === null);
    const [line] = free;
    if (free.length !== 1 || line === undefined) {
      context.stats.ordersUnresolved++;
      continue;
    }
    line.customerItemId = id;
    context.links.set(line.id, id);
    context.stats.ordersLinked++;
  }
}

async function linkOrderItems(database: QueryClientContract, links: Map<number, string>) {
  const entries = [...links];
  for (let start = 0; start < entries.length; start += 500) {
    const chunk = entries.slice(start, start + 500);
    await database.rawQuery(
      `UPDATE order_items SET customer_item_id = link.customer_item_id
       FROM (VALUES ${chunk.map(() => "(?::integer, ?::varchar)").join(", ")}) AS link(id, customer_item_id)
       WHERE order_items.id = link.id`,
      chunk.flat(),
    );
  }
}

function existingUser(
  value: unknown,
  context: MapContext,
  counter: "customerDeleted" | "handoutEmployeeDeleted" | "returnEmployeeDeleted",
): string | null {
  const id = hexId(value);
  if (id !== null && !context.users.has(id)) {
    context.stats[counter]++;
    return null;
  }
  return id;
}

function existingOrder(value: unknown, context: MapContext): string | null {
  const id = hexId(value);
  if (id !== null && !context.orders.has(id)) {
    context.stats.stateOrderMissing++;
    return null;
  }
  return id;
}

function recordOf(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- narrowed to a non-array object
      (value as Record<string, unknown>)
    : {};
}

function dateOrNull(value: unknown): Date | null {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : null;
}

function requiredDate(value: unknown, field: string): Date {
  const date = dateOrNull(value);
  if (date === null) {
    throw new TypeError(`missing date in ${field}`);
  }
  return date;
}
