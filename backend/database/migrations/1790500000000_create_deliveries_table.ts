import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Step 10 of the MongoDB → Postgres migration: deliveries move from MongoDB to Postgres, keeping
 * their Mongo ids. The relationship is inverted: the delivery owns a unique `order_id`, and
 * `orders.delivery_id` is dropped once every delivery is in place.
 *
 * Schema fixes made on the way, backed by a staging survey:
 * - `info` becomes columns: the branch of a pickup, and for Bring the price Bring charges
 *   (`bring_amount`, next to `amount`, which is what the customer paid), the estimated delivery,
 *   the facility and shipment addresses, the postal codes, the product and the tracking number.
 * - The meta fields `user`, `editableFor`, `viewableFor` and `active` are dropped.
 *
 * Only the delivery each order names is transferred (decided after the staging survey). The
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

    // The MongoDB transfer that ran here (2026-09-27) was removed on 2026-09-28.

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
