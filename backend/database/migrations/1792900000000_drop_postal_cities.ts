import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * A postal city follows from its postal code, so it is looked up in Posten's register (see
 * `PostalCodeService`) instead of stored. The stored copies were typed by hand and disagreed with
 * the register and each other ("Olso", "Oalo", a district instead of the post town).
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.raw("ALTER TABLE deliveries DROP CONSTRAINT deliveries_bring_complete");
    this.schema.raw(
      `ALTER TABLE deliveries ADD CONSTRAINT deliveries_bring_complete CHECK (method <> 'bring' OR (
        bring_amount IS NOT NULL AND facility_address IS NOT NULL AND facility_postal_code IS NOT NULL
        AND shipment_name IS NOT NULL AND shipment_address IS NOT NULL AND shipment_postal_code IS NOT NULL
        AND from_postal_code IS NOT NULL AND to_postal_code IS NOT NULL))`,
    );
    this.schema.alterTable("deliveries", (table) => {
      table.dropColumn("facility_postal_city");
      table.dropColumn("shipment_postal_city");
    });
    this.schema.alterTable("invoices", (table) => {
      table.dropColumn("customer_post_city");
    });
    this.schema.alterTable("companies", (table) => {
      table.dropColumn("post_city");
    });
    this.schema.alterTable("users", (table) => {
      table.dropColumn("post_city");
    });
  }

  /** The columns come back empty; the cities are not restored. */
  override async down() {
    this.schema.alterTable("users", (table) => {
      table.text("post_city").nullable();
    });
    this.schema.alterTable("companies", (table) => {
      table.text("post_city").notNullable().defaultTo("");
    });
    this.schema.alterTable("invoices", (table) => {
      table.text("customer_post_city").nullable();
    });
    this.schema.alterTable("deliveries", (table) => {
      table.text("facility_postal_city").nullable();
      table.text("shipment_postal_city").nullable();
    });
  }
}
