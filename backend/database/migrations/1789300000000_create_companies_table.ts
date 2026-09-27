import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Step 2 of the MongoDB → Postgres migration: the companies we invoice by hand (schools and
 * municipalities buying books outright) move from MongoDB to Postgres, keeping their Mongo ids.
 *
 * Schema fixes made on the way, backed by a staging survey: the
 * `contactInfo` subdocument is flattened, every text column is `not null` (all 24 documents had
 * every field filled and the validator has always required them), and the meta fields `user`,
 * `editableFor`, `viewableFor` and `active` (always `true`) are dropped. Nothing references
 * companies yet: `invoices.customerInfo.companyDetail` is null on every invoice, so step 12 adds
 * `invoices.company_id` as a nullable key.
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("companies", (table) => {
      table.string("id", 24).primary();
      table.text("name").notNullable();
      table.text("phone").notNullable();
      table.text("email").notNullable();
      table.text("address").notNullable();
      table.text("post_code").notNullable();
      table.text("post_city").notNullable();
      // The customer number in our accounting system; today always the organization number.
      table.text("customer_number").notNullable();
      // Not unique: two companies can share an invoice centre (Oslo kommune and Ullern vgs do).
      table.text("organization_number").notNullable();

      table.timestamp("created_at");
      table.timestamp("updated_at");
    });

    // The MongoDB transfer that ran here (2026-09-16) was removed on 2026-09-28.
  }

  override async down() {
    this.schema.dropTable("companies");
  }
}
