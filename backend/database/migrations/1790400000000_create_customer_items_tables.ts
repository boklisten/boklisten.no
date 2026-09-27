import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Step 9 of the MongoDB → Postgres migration: customer items move from MongoDB to Postgres, keeping
 * their Mongo ids, and the embedded `periodExtends` array becomes `customer_item_period_extends`.
 *
 * Schema fixes made on the way, backed by a staging survey:
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
 * Orphans, decided after the staging survey: customers and employees deleted by the old
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

    // The MongoDB transfer that ran here (2026-09-27) was removed on 2026-09-28.

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
