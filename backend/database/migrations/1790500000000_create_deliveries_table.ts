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
 * Step 10 of `docs/postgres-migration-plan.md`: deliveries move from MongoDB to Postgres, keeping
 * their Mongo ids. The relationship is inverted: the delivery owns a unique `order_id`, and
 * `orders.delivery_id` is dropped once every delivery is in place.
 *
 * Schema fixes made on the way, backed by the staging survey recorded in the plan:
 * - `info` becomes columns: the branch of a pickup, and for Bring the price Bring charges
 *   (`bring_amount`, next to `amount`, which is what the customer paid), the estimated delivery,
 *   the facility and shipment addresses, the postal codes, the product and the tracking number.
 * - The meta fields `user`, `editableFor`, `viewableFor` and `active` are dropped.
 *
 * Only the delivery each order names is transferred (decided in the plan's step 10 section). The
 * others are dead: most name an unplaced checkout order that the old cleanup deleted, the rest were
 * replaced by a later delivery when the customer picked the delivery method again. Orders naming a
 * delivery that no longer exists (almost all from 2018, before the collection's first document)
 * lose the reference with the column.
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("deliveries", (table) => {
      table.string("id", 24).primary();
      // CASCADE: a delivery is part of its order.
      table
        .string("order_id", 24)
        .notNullable()
        .unique()
        .references("id")
        .inTable("orders")
        .onDelete("CASCADE");
      table.enu("method", ["branch", "bring"]).notNullable();
      // What the customer paid for the delivery; 0 when the branch covers it.
      table.integer("amount").notNullable();

      // Pickup at a branch. SET NULL: the delivery record outlives the branch.
      table
        .string("branch_id", 24)
        .nullable()
        .references("id")
        .inTable("branches")
        .onDelete("SET NULL");

      // Bring shipment.
      table.integer("bring_amount").nullable();
      table.timestamp("estimated_delivery").nullable();
      table.text("facility_address").nullable();
      table.text("facility_postal_code").nullable();
      table.text("facility_postal_city").nullable();
      table.text("shipment_name").nullable();
      table.text("shipment_address").nullable();
      table.text("shipment_postal_code").nullable();
      table.text("shipment_postal_city").nullable();
      table.text("from_postal_code").nullable();
      table.text("to_postal_code").nullable();
      // Bring product code: 3584 is a mailbox parcel, SERVICEPAKKE goes to a pickup point.
      table.enu("product", ["3584", "SERVICEPAKKE"]).nullable();
      table.text("tracking_number").nullable();

      table.timestamp("created_at").notNullable();
      table.timestamp("updated_at").notNullable();
    });
    // A pickup names its branch; a shipment names none.
    this.schema.raw(
      "ALTER TABLE deliveries ADD CONSTRAINT deliveries_branch_matches_method CHECK ((method = 'branch') = (branch_id IS NOT NULL))",
    );
    // Every shipment has its price, both addresses and both postal codes (true of every transferred one).
    this.schema.raw(
      `ALTER TABLE deliveries ADD CONSTRAINT deliveries_bring_complete CHECK (method <> 'bring' OR (
        bring_amount IS NOT NULL AND facility_address IS NOT NULL AND facility_postal_code IS NOT NULL
        AND facility_postal_city IS NOT NULL AND shipment_name IS NOT NULL AND shipment_address IS NOT NULL
        AND shipment_postal_code IS NOT NULL AND shipment_postal_city IS NOT NULL
        AND from_postal_code IS NOT NULL AND to_postal_code IS NOT NULL))`,
    );

    this.defer(async (database) => {
      if (env.get("API_ENV") === "test") {
        return;
      }
      const orders = await deliveryIdsByOrder(database);
      const transferred = new Set<string>();
      await withMongo(async (mongo) => {
        const { migrated } = await transferCollection({
          mongo,
          database,
          collection: "deliveries",
          table: "deliveries",
          map: (document) => mapDelivery(document, orders, transferred),
        });
        await assertRowCount(database, "deliveries", migrated);
        const dangling = [...orders.values()].filter(
          (deliveryId) => deliveryId !== null && !transferred.has(deliveryId),
        ).length;
        console.log(`orders: ${dangling} references to missing deliveries dropped`);
        await dropCollection(mongo, "deliveries");
      });
    });

    this.schema.alterTable("orders", (table) => {
      table.dropColumn("delivery_id");
    });
  }

  override async down() {
    this.schema.alterTable("orders", (table) => {
      table.string("delivery_id", 24).nullable();
      table.index(["delivery_id"]);
    });
    this.defer(async (database) => {
      await database.rawQuery(
        "UPDATE orders SET delivery_id = deliveries.id FROM deliveries WHERE deliveries.order_id = orders.id",
      );
    });
    this.schema.dropTable("deliveries");
  }
}

/** Every order's `delivery_id`, keyed by order id. */
async function deliveryIdsByOrder(
  database: QueryClientContract,
): Promise<Map<string, string | null>> {
  const rows: { id: string; delivery_id: string | null }[] = await database
    .from("orders")
    .select("id", "delivery_id");
  return new Map(rows.map((row) => [row.id, row.delivery_id]));
}

function mapDelivery(
  document: Document,
  orders: Map<string, string | null>,
  transferred: Set<string>,
): MapResult {
  const id = requiredHexId(document["_id"], "deliveries._id");
  const orderId = requiredHexId(document["order"], `deliveries.${id}.order`);
  if (!orders.has(orderId)) {
    return skip("order no longer exists");
  }
  if (orders.get(orderId) !== id) {
    return skip("not the delivery its order names");
  }
  transferred.add(id);

  const info = recordOf(document["info"]);
  const method = document["method"];
  if (method === "branch") {
    return {
      row: {
        id,
        order_id: orderId,
        method,
        amount: document["amount"],
        branch_id: requiredHexId(info["branch"], `deliveries.${id}.info.branch`),
        ...timestampsOf(document),
      },
    };
  }
  const facility = recordOf(info["facilityAddress"]);
  const shipment = recordOf(info["shipmentAddress"]);
  return {
    row: {
      id,
      order_id: orderId,
      method,
      amount: document["amount"],
      bring_amount: typeof info["amount"] === "number" ? info["amount"] : null,
      estimated_delivery:
        info["estimatedDelivery"] instanceof Date ? info["estimatedDelivery"] : null,
      facility_address: textOrNull(facility["address"]),
      facility_postal_code: textOrNull(facility["postalCode"]),
      facility_postal_city: textOrNull(facility["postalCity"]),
      shipment_name: textOrNull(shipment["name"]),
      shipment_address: textOrNull(shipment["address"]),
      shipment_postal_code: textOrNull(shipment["postalCode"]),
      shipment_postal_city: textOrNull(shipment["postalCity"]),
      from_postal_code: textOrNull(info["from"]),
      to_postal_code: textOrNull(info["to"]),
      product: textOrNull(info["product"]),
      tracking_number: textOrNull(info["trackingNumber"]),
      ...timestampsOf(document),
    },
  };
}

function recordOf(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- narrowed to a non-array object
      (value as Record<string, unknown>)
    : {};
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
