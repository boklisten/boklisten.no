import { BaseSchema } from "@adonisjs/lucid/schema";

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
 * Step 8 of the MongoDB → Postgres migration: orders move from MongoDB to Postgres, keeping their
 * Mongo ids, and the embedded `orderItems` array becomes the `order_items` child table (its
 * `position` keeps the order of the lines).
 *
 * Schema fixes made on the way, backed by a staging survey:
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
 * Orphans, decided after the staging survey: customers and employees deleted by the old
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

    // The MongoDB transfer that ran here (2026-09-27) was removed on 2026-09-28.

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
