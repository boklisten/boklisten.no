import { BaseSchema } from "@adonisjs/lucid/schema";
import type { QueryClientContract } from "@adonisjs/lucid/types/database";
import type { Document } from "mongodb";

import {
  assertRowCount,
  dropCollection,
  requiredHexId,
  skip,
  timestampsOf,
  transferCollection,
  withMongo,
} from "#database/helpers/mongo_transfer";
import type { MapResult } from "#database/helpers/mongo_transfer";
import env from "#start/env";

/**
 * Step 11 of `docs/postgres-migration-plan.md`: payments move from MongoDB to Postgres, keeping
 * their Mongo ids.
 *
 * Schema fixes made on the way, backed by the staging survey recorded in the plan:
 * - `customer` and `branch` are dropped: a payment is part of its order, whose customer it always
 *   named, and every writer records the order's branch. Reports join through `orders`.
 * - `info` is dropped: only historic DIBS payments carry it, nothing reads it, and it held the
 *   customer's personal details.
 * - The meta fields `user`, `editableFor`, `viewableFor` and `active` are dropped.
 *
 * Payments whose order no longer exists are skipped (decided in the plan's step 11 section): almost
 * all are abandoned DIBS attempts on checkout orders the old cleanup deleted.
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("payments", (table) => {
      table.string("id", 24).primary();
      // CASCADE: a payment is part of its order.
      table
        .string("order_id", 24)
        .notNullable()
        .references("id")
        .inTable("orders")
        .onDelete("CASCADE");
      table
        .enu("method", [
          "card",
          "cash",
          "vipps",
          "vipps-checkout",
          "vipps-epayment",
          "bank-transfer",
          // A retired payment gateway; only historic payments carry it.
          "dibs",
        ])
        .notNullable();
      // Negative for a refund.
      table.integer("amount").notNullable();
      table.boolean("confirmed").notNullable().defaultTo(false);
      table.timestamp("created_at").notNullable();
      table.timestamp("updated_at").notNullable();

      table.index(["order_id"]);
      // The payments report selects by creation time.
      table.index(["created_at"]);
    });

    this.defer(async (database) => {
      if (env.get("API_ENV") === "test") {
        return;
      }
      const orderIds = await allOrderIds(database);
      await withMongo(async (mongo) => {
        const { migrated } = await transferCollection({
          mongo,
          database,
          collection: "payments",
          table: "payments",
          map: (document) => mapPayment(document, orderIds),
        });
        await assertRowCount(database, "payments", migrated);
        await dropCollection(mongo, "payments");
      });
    });
  }

  override async down() {
    this.schema.dropTable("payments");
  }
}

async function allOrderIds(database: QueryClientContract): Promise<Set<string>> {
  const rows: { id: string }[] = await database.from("orders").select("id");
  return new Set(rows.map((row) => row.id));
}

function mapPayment(document: Document, orderIds: Set<string>): MapResult {
  const id = requiredHexId(document["_id"], "payments._id");
  const orderId = requiredHexId(document["order"], `payments.${id}.order`);
  if (!orderIds.has(orderId)) {
    return skip("order no longer exists");
  }
  return {
    row: {
      id,
      order_id: orderId,
      method: document["method"],
      amount: document["amount"],
      confirmed: document["confirmed"] === true,
      ...timestampsOf(document),
    },
  };
}
