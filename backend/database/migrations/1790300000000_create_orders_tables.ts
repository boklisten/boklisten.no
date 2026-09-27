import { BaseSchema } from "@adonisjs/lucid/schema";
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
import type { Db, MapResult, Row } from "#database/helpers/mongo_transfer";
import env from "#start/env";

const ORDER_ITEM_TYPES = [
  "rent",
  "buy",
  "extend",
  "sell",
  "buyout",
  "return",
  "cancel",
  "partly-payment",
  "buyback",
  "invoice-paid",
  "match-receive",
  "match-deliver",
] as const;

/**
 * Step 8 of `docs/postgres-migration-plan.md`: orders move from MongoDB to Postgres, keeping their
 * Mongo ids, and the embedded `orderItems` array becomes the `order_items` child table (its
 * `position` keeps the order of the lines).
 *
 * Schema fixes made on the way, backed by the staging survey recorded in the plan:
 * - `orderItems.title` is dropped (titles are read from `items`); `info` becomes columns, and
 *   `info.customerItem` (a duplicate of `customerItem`, never conflicting) fills
 *   `customer_item_id` where only it is set.
 * - `payments` is dropped: `payments.order` names the same payments (the survey found ~140 old
 *   DIBS attempts missing from the arrays), and this migration gives Mongo the index that lookup
 *   needs until the payments step moves them too.
 * - `notification.email` becomes `notify_by_email`, true unless the order said false (the code only
 *   ever acted on an explicit false).
 * - The meta fields `user`, `editableFor`, `viewableFor`, `active` (never false), the dead
 *   `pendingSignature` and the five `kustomCheckoutId` leftovers are dropped.
 *
 * Orphans, decided in the plan's step 8 section: customers and employees deleted by the old
 * three-year user cleanup become NULL (orders outlive their customer); moved-from/moved-to
 * references to orders that no longer exist become NULL; lines naming the book deleted from the
 * catalogue are left behind, and so are the orders that consisted only of such lines.
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("orders", (table) => {
      table.string("id", 24).primary();
      table.integer("amount").notNullable();
      // RESTRICT: a branch with order history is never deleted.
      table
        .string("branch_id", 24)
        .notNullable()
        .references("id")
        .inTable("branches")
        .onDelete("RESTRICT");
      // SET NULL: orders are book history and accounting and outlive a deleted customer.
      table
        .string("customer_id", 24)
        .nullable()
        .references("id")
        .inTable("users")
        .onDelete("SET NULL");
      table.boolean("by_customer").notNullable().defaultTo(false);
      // SET NULL: the employee who took the order is an optional back-reference.
      table
        .string("employee_id", 24)
        .nullable()
        .references("id")
        .inTable("users")
        .onDelete("SET NULL");
      table.boolean("placed").notNullable().defaultTo(false);
      // Plain column until the deliveries step turns the relationship around.
      table.string("delivery_id", 24).nullable();
      table.boolean("notify_by_email").notNullable().defaultTo(true);
      // Vipps Checkout's session state vocabulary, reused by the Kasse Vipps flow.
      table.text("checkout_state").nullable();

      table.timestamp("created_at").notNullable();
      table.timestamp("updated_at").notNullable();

      table.index(["placed", "created_at"]);
      table.index(["customer_id", "created_at"]);
      table.index(["branch_id", "created_at"]);
      table.index(["placed", "updated_at"]);
      table.index(["delivery_id"]);
    });

    this.schema.createTable("order_items", (table) => {
      table.increments("id");
      // CASCADE: a line is part of its order.
      table
        .string("order_id", 24)
        .notNullable()
        .references("id")
        .inTable("orders")
        .onDelete("CASCADE");
      table.smallint("position").notNullable();
      table.enu("type", [...ORDER_ITEM_TYPES]).notNullable();
      // RESTRICT: a title with order history cannot be deleted from the catalogue.
      table
        .string("item_id", 24)
        .notNullable()
        .references("id")
        .inTable("items")
        .onDelete("RESTRICT");
      table.text("blid").nullable();
      table.integer("amount").notNullable();
      table.integer("unit_price").notNullable();
      table.boolean("delivered").notNullable().defaultTo(false);
      table.boolean("handout").notNullable().defaultTo(false);
      // The foreign key arrives with the customer-items step.
      table.string("customer_item_id", 24).nullable();
      table.timestamp("period_from").nullable();
      table.timestamp("period_to").nullable();
      table.integer("number_of_periods").nullable();
      table.enu("period_type", ["semester", "year"]).nullable();
      table.integer("amount_left_to_pay").nullable();
      table.integer("buyback_amount").nullable();
      // Keys added after the transfer: they point at rows of the same table.
      table.string("moved_from_order_id", 24).nullable();
      table.string("moved_to_order_id", 24).nullable();

      table.unique(["order_id", "position"]);
      table.index(["customer_item_id"]);
      table.index(["blid"]);
      table.index(["item_id"]);
    });

    this.defer(async (database) => {
      if (env.get("API_ENV") === "test") {
        return;
      }
      const catalogue = new Set<string>(
        (await database.from("items").select("id")).map((row: { id: string }) => row.id),
      );
      const users = new Set<string>(
        (await database.from("users").select("id")).map((row: { id: string }) => row.id),
      );
      await withMongo(async (mongo) => {
        const context: MapContext = {
          catalogue,
          users,
          orders: await transferredOrderIds(mongo, catalogue),
          stats: {
            customerDeleted: 0,
            employeeDeleted: 0,
            movedFromMissing: 0,
            movedToMissing: 0,
            linesWithoutCatalogueItem: 0,
          },
        };
        const { migrated } = await transferCollection({
          mongo,
          database,
          collection: "orders",
          table: "orders",
          map: (document) => mapOrder(document, context),
        });
        const { stats } = context;
        console.log(
          `orders: ${stats.customerDeleted} deleted customers and ${stats.employeeDeleted} deleted employees set to null, ` +
            `${stats.movedFromMissing} moved-from and ${stats.movedToMissing} moved-to references to missing orders set to null, ` +
            `${stats.linesWithoutCatalogueItem} lines whose item is no longer in the catalogue dropped`,
        );
        await assertRowCount(database, "orders", migrated);

        const orphanedHandovers = database
          .from("book_handovers")
          .whereNotNull("order_id")
          .whereNotIn("order_id", database.from("orders").select("id"));
        const [orphans] = await orphanedHandovers.clone().count("* as total");
        await orphanedHandovers.update({ order_id: null });
        console.log(
          `book_handovers: ${Number(orphans?.total ?? 0)} references to missing orders set to null`,
        );

        // Payments stay in Mongo for a few more steps and are now found by their order.
        await mongo.collection("payments").createIndex({ order: 1 });
        await dropCollection(mongo, "orders");
      });
    });

    this.schema.alterTable("order_items", (table) => {
      // SET NULL: the history of a moved line survives the deletion of either order.
      table.foreign("moved_from_order_id").references("id").inTable("orders").onDelete("SET NULL");
      table.foreign("moved_to_order_id").references("id").inTable("orders").onDelete("SET NULL");
    });
    this.schema.alterTable("book_handovers", (table) => {
      // SET NULL: the handover is match history and outlives the order that recorded it.
      table.foreign("order_id").references("id").inTable("orders").onDelete("SET NULL");
    });
  }

  override async down() {
    this.schema.alterTable("book_handovers", (table) => {
      table.dropForeign(["order_id"]);
    });
    this.schema.dropTable("order_items");
    this.schema.dropTable("orders");
  }
}

interface MapContext {
  catalogue: Set<string>;
  users: Set<string>;
  orders: Set<string>;
  stats: {
    customerDeleted: number;
    employeeDeleted: number;
    movedFromMissing: number;
    movedToMissing: number;
    linesWithoutCatalogueItem: number;
  };
}

/** The orders that will exist in Postgres: all but those `mapOrder` skips. */
async function transferredOrderIds(mongo: Db, catalogue: Set<string>): Promise<Set<string>> {
  const ids = new Set<string>();
  const documents = mongo
    .collection("orders")
    .find({}, { projection: { _id: 1, "orderItems.item": 1 } });
  for await (const document of documents) {
    const lines: unknown[] = Array.isArray(document["orderItems"]) ? document["orderItems"] : [];
    const skipped =
      lines.length > 0 &&
      lines.every((line) => !catalogue.has(hexId(recordOf(line)["item"]) ?? ""));
    if (!skipped) {
      ids.add(requiredHexId(document._id, "orders._id"));
    }
  }
  return ids;
}

function mapOrder(document: Document, context: MapContext): MapResult {
  const id = requiredHexId(document["_id"], "orders._id");
  const lines: unknown[] = Array.isArray(document["orderItems"]) ? document["orderItems"] : [];
  const orderItems: Row[] = [];
  for (const line of lines) {
    const orderItem = recordOf(line);
    const itemId = requiredHexId(orderItem["item"], `orders.${id}.orderItems.item`);
    if (!context.catalogue.has(itemId)) {
      context.stats.linesWithoutCatalogueItem++;
      continue;
    }
    const info = recordOf(orderItem["info"]);
    orderItems.push({
      order_id: id,
      position: orderItems.length,
      type: orderItem["type"],
      item_id: itemId,
      blid: typeof orderItem["blid"] === "string" ? orderItem["blid"] : null,
      amount: orderItem["amount"],
      unit_price: orderItem["unitPrice"],
      delivered: orderItem["delivered"] === true,
      handout: orderItem["handout"] === true,
      customer_item_id: hexId(orderItem["customerItem"]) ?? hexId(info["customerItem"]),
      period_from: dateOrNull(info["from"]),
      period_to: dateOrNull(info["to"]),
      number_of_periods: info["numberOfPeriods"] ?? null,
      period_type: info["periodType"] ?? null,
      amount_left_to_pay: info["amountLeftToPay"] ?? null,
      buyback_amount: info["buybackAmount"] ?? null,
      moved_from_order_id: existingOrder(orderItem["movedFromOrder"], context, "movedFromMissing"),
      moved_to_order_id: existingOrder(orderItem["movedToOrder"], context, "movedToMissing"),
    });
  }
  if (orderItems.length === 0 && lines.length > 0) {
    console.log(`orders.${id}: every line names an item no longer in the catalogue, dropped`);
    return skip("only lines whose item is no longer in the catalogue");
  }

  const notification = recordOf(document["notification"]);
  return {
    row: {
      id,
      amount: document["amount"],
      branch_id: requiredHexId(document["branch"], `orders.${id}.branch`),
      customer_id: existingUser(document["customer"], context, "customerDeleted"),
      by_customer: document["byCustomer"] === true,
      employee_id: existingUser(document["employee"], context, "employeeDeleted"),
      placed: document["placed"] === true,
      delivery_id: hexId(document["delivery"]),
      notify_by_email: notification["email"] !== false,
      checkout_state:
        typeof document["checkoutState"] === "string" ? document["checkoutState"] : null,
      ...timestampsOf(document),
    },
    children: { order_items: orderItems },
  };
}

function existingUser(
  value: unknown,
  context: MapContext,
  counter: "customerDeleted" | "employeeDeleted",
): string | null {
  const id = hexId(value);
  if (id !== null && !context.users.has(id)) {
    context.stats[counter]++;
    return null;
  }
  return id;
}

function existingOrder(
  value: unknown,
  context: MapContext,
  counter: "movedFromMissing" | "movedToMissing",
): string | null {
  const id = hexId(value);
  if (id !== null && !context.orders.has(id)) {
    context.stats[counter]++;
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
