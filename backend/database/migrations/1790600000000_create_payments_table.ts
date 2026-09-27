import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Step 11 of the MongoDB → Postgres migration: payments move from MongoDB to Postgres, keeping
 * their Mongo ids.
 *
 * Schema fixes made on the way, backed by a staging survey:
 * - `customer` and `branch` are dropped: a payment is part of its order, whose customer it always
 *   named, and every writer records the order's branch. Reports join through `orders`.
 * - `info` is dropped: only historic DIBS payments carry it, nothing reads it, and it held the
 *   customer's personal details.
 * - The meta fields `user`, `editableFor`, `viewableFor` and `active` are dropped.
 *
 * Payments whose order no longer exists are skipped (decided after the staging survey): almost
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

    // The MongoDB transfer that ran here (2026-09-27) was removed on 2026-09-28.
  }

  override async down() {
    this.schema.dropTable("payments");
  }
}
