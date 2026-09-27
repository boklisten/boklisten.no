import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Step 12 of the MongoDB → Postgres migration: invoices move from MongoDB to Postgres, keeping
 * their Mongo ids, and the embedded `customerItemPayments` array becomes `invoice_lines`.
 *
 * Invoices are accounting documents, so the customer as it was when the invoice was made stays on
 * the invoice as columns and outlives the customer: `customer_id` only links to the customer while
 * they exist. Schema fixes made on the way, backed by a staging survey:
 * - `customerHavePayed` becomes `customer_has_paid`, `invoiceId` becomes `invoice_number`,
 *   `duedate` becomes `due_date`; `customerInfo`, `postal` and `payment` become columns.
 * - `customer_number` is the number the accounting systems know the customer by. Company invoices
 *   stored it; for pupils the exports derived it from the user id, which is gone once the user is
 *   deleted, so it is derived here once, with the same rules, and stored.
 * - The date of birth becomes a calendar day; the four impossible ones become NULL.
 * - `comments` becomes one `comment` column: only company invoices carry comments, one each, and
 *   never with a user.
 * - Dropped: `customerInfo.branchName` (every reader shows the branch's current name),
 *   `customerInfo.companyDetail` (never set), the line fields no document carries
 *   (`customerNumber`, `organizationNumber`), and the meta fields `user`, `editableFor`,
 *   `viewableFor` and `active` (never false).
 *
 * Orphans, decided after the staging survey: invoices of customers deleted by the old
 * three-year user cleanup keep their snapshot with `customer_id` NULL. Every branch, customer item
 * and book an invoice names exists.
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("invoices", (table) => {
      table.string("id", 24).primary();
      // Not unique: two 2020 company invoices were reissued under the credited invoice's number.
      table.text("invoice_number").notNullable();
      // "loan" is a legacy name for rent; company invoices and the oldest invoices have no type.
      table.enu("type", ["rent", "partly-payment", "loan"]).nullable();
      table.timestamp("due_date").notNullable();
      table.boolean("customer_has_paid").notNullable().defaultTo(false);
      table.boolean("to_credit_note").notNullable().defaultTo(false);
      table.boolean("to_debt_collection").notNullable().defaultTo(false);
      table.boolean("to_loss_note").notNullable().defaultTo(false);
      // SET NULL: an invoice is bookkeeping and outlives the branch. Company invoices have none.
      table
        .string("branch_id", 24)
        .nullable()
        .references("id")
        .inTable("branches")
        .onDelete("SET NULL");
      // SET NULL: an invoice is bookkeeping and outlives the customer; the columns below keep who
      // they were. Company invoices have none.
      table
        .string("customer_id", 24)
        .nullable()
        .references("id")
        .inTable("users")
        .onDelete("SET NULL");
      table.text("customer_number").notNullable();
      table.text("customer_name").notNullable();
      table.text("customer_email").notNullable();
      table.text("customer_phone").notNullable();
      table.date("customer_dob").nullable();
      // Only on company invoices, which is how they are told apart.
      table.text("customer_organization_number").nullable();
      table.text("customer_address").notNullable();
      table.text("customer_post_code").notNullable();
      table.text("customer_post_city").notNullable();
      // Only company invoices carry a country.
      table.text("customer_country").nullable();
      // Company invoices are written by hand in kroner and øre.
      table.decimal("total_gross", 10, 2).notNullable();
      table.decimal("total_net", 10, 2).notNullable();
      table.decimal("total_vat", 10, 2).notNullable();
      // The sum of the line discounts, not a percentage of the total.
      table.decimal("total_discount", 10, 2).notNullable();
      table.decimal("fee_unit", 10, 2).nullable();
      table.decimal("fee_gross", 10, 2).nullable();
      table.decimal("fee_net", 10, 2).nullable();
      table.decimal("fee_vat", 10, 2).nullable();
      table.decimal("fee_discount", 10, 2).nullable();
      table.decimal("total_including_fee", 10, 2).notNullable();
      table.text("reference").notNullable();
      table.text("our_reference").nullable();
      table.text("comment").nullable();
      table.timestamp("created_at").notNullable();
      table.timestamp("updated_at").notNullable();

      table.index(["invoice_number"]);
      table.index(["customer_id"]);
      table.index(["branch_id"]);
    });
    // Pupils' invoices carry the whole fee; company invoices carry none.
    this.schema.raw(
      "ALTER TABLE invoices ADD CONSTRAINT invoices_fee_complete CHECK (num_nonnulls(fee_unit, fee_gross, fee_net, fee_vat, fee_discount) IN (0, 5))",
    );

    this.schema.createTable("invoice_lines", (table) => {
      table.increments("id");
      // CASCADE: a line is part of its invoice.
      table
        .string("invoice_id", 24)
        .notNullable()
        .references("id")
        .inTable("invoices")
        .onDelete("CASCADE");
      table.smallint("position").notNullable();
      // SET NULL: the line keeps its title and amounts. Company invoice lines have none.
      table
        .string("customer_item_id", 24)
        .nullable()
        .references("id")
        .inTable("customer_items")
        .onDelete("SET NULL");
      // RESTRICT: the exported article number is derived from the book's id. Company invoice
      // lines have none.
      table.string("item_id", 24).nullable().references("id").inTable("items").onDelete("RESTRICT");
      table.enu("customer_item_type", ["rent", "partly-payment"]).nullable();
      table.text("title").notNullable();
      // Only on company invoice lines.
      table.integer("product_number").nullable();
      table.integer("number_of_items").notNullable();
      table.boolean("cancel").notNullable().defaultTo(false);
      table.decimal("unit", 10, 2).notNullable();
      table.decimal("gross", 10, 2).notNullable();
      table.decimal("net", 10, 2).notNullable();
      table.decimal("vat", 10, 2).notNullable();
      // In percent.
      table.decimal("discount", 10, 2).notNullable();

      table.unique(["invoice_id", "position"]);
      table.index(["customer_item_id"]);
      table.index(["item_id"]);
    });

    // The MongoDB transfer that ran here (2026-09-28) was removed on 2026-09-28.
  }

  override async down() {
    this.schema.dropTable("invoice_lines");
    this.schema.dropTable("invoices");
  }
}
