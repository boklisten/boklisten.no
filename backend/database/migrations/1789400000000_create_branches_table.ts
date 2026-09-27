import { BaseSchema } from "@adonisjs/lucid/schema";

const REFERENCING_TABLES = ["branch_subjects", "opening_hours", "waiting_list_customers"];

const PERIOD_KINDS = ["partly_payment", "rent", "extend"] as const;

/**
 * Step 3 of the MongoDB → Postgres migration: the branches (schools, their year groups and
 * classes, privatist schools, the web shop) move from MongoDB to Postgres, keeping their Mongo ids,
 * together with their payment periods, which become the child table `branch_periods`. The three
 * existing columns that already hold branch ids become real foreign keys.
 *
 * Schema fixes made on the way, backed by a staging survey: the
 * `paymentInfo`, `deliveryMethods`, `isBranchItemsLive` and `location` subdocuments are
 * flattened; `childBranches` is dropped (the parent side is the source of truth and the survey
 * found the two sides fully consistent); `branchItems` is dropped (3 506 of its 4 027 entries
 * pointed at deleted branch items, and nothing reads it: the branch items collection carries the
 * `branch` reference itself); the meta fields `user`, `editableFor`, `viewableFor` and the
 * Mongoose subdocument `_id` artefacts are dropped. `active` stays: 11 branches are inactive and
 * the public listing must not show them.
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("branches", (table) => {
      table.string("id", 24).primary();
      // The fully qualified name, e.g. "Ullern videregående skole VG1".
      table.text("name").notNullable();
      // URL of the school's logo. Never set on any surveyed branch, but the form offers it.
      table.text("logo").nullable();
      // Which set of payment periods applies (VGS: rent, privatist: partly payment). NULL on the
      // organisational levels of the tree (a school's year groups) and the web shop.
      table.enu("type", ["VGS", "privatist"]).nullable();
      // Self reference; the key is added below, after the transfer, because a parent can arrive in
      // a later batch than its child.
      table.string("parent_branch_id", 24).nullable().index();
      // The name relative to the parent, e.g. "VG1"; shown in trees and pickers.
      table.text("local_name").nullable();
      // What this branch's children represent, e.g. "klasse".
      table.text("child_label").nullable();
      // Inactive branches are hidden from customers and from non-admin lookups.
      table.boolean("active").notNullable().defaultTo(true);
      // The school pays for the books instead of the customer.
      table.boolean("payment_responsible").notNullable().defaultTo(false);
      // The school pays for postal delivery.
      table.boolean("responsible_for_delivery").notNullable().defaultTo(false);
      // Fractions of the item price (0–1) for buying out a rented book and for what the branch
      // pays when buying a book back. Doubles so the driver returns numbers.
      table.double("buyout_percentage").notNullable().defaultTo(1);
      table.double("sell_percentage").notNullable().defaultTo(1);
      table.boolean("delivery_at_branch").notNullable().defaultTo(true);
      table.boolean("delivery_by_mail").notNullable().defaultTo(true);
      // Whether customers (online) and employees (at the branch) can order the branch's books.
      table.boolean("branch_items_live_online").notNullable().defaultTo(false);
      table.boolean("branch_items_live_at_branch").notNullable().defaultTo(false);
      // Free text, e.g. "Oslo"; groups branches in the order flow's branch picker.
      table.text("region").notNullable();
      table.text("address").nullable();

      table.timestamp("created_at");
      table.timestamp("updated_at");
    });

    this.schema.createTable("branch_periods", (table) => {
      table.increments("id");
      // CASCADE: a period is configuration of its branch and means nothing without it.
      table
        .string("branch_id", 24)
        .notNullable()
        .references("id")
        .inTable("branches")
        .onDelete("CASCADE");
      table.enu("kind", PERIOD_KINDS).notNullable();
      table.enu("period_type", ["semester", "year"]).notNullable();
      // The deadline the period ends on.
      table.timestamp("date").notNullable();
      // rent and extend: how many periods of this type one book may be rented or extended.
      table.integer("max_number_of_periods").nullable();
      // rent: the fraction of the item price the customer pays. extend: optional override of the
      // fixed price below (never set on any surveyed branch).
      table.double("percentage").nullable();
      // extend: the fixed price in whole NOK.
      table.integer("price").nullable();
      // partly_payment: fractions of the item price for buying out, and for the first payment,
      // each with a variant for used books.
      table.double("percentage_buyout").nullable();
      table.double("percentage_buyout_used").nullable();
      table.double("percentage_up_front").nullable();
      table.double("percentage_up_front_used").nullable();

      table.index(["branch_id", "kind"]);
    });

    // Two of the referencing columns predate the string(24) convention.
    for (const referencingTable of ["opening_hours", "waiting_list_customers"]) {
      this.schema.alterTable(referencingTable, (table) => {
        table.string("branch_id", 24).notNullable().alter();
      });
    }

    // The MongoDB transfer that ran here (2026-09-16) was removed on 2026-09-28.

    // The referencing rows already exist (and a branch's parent may be transferred after it), so
    // the keys can only be added once the transfer above has filled `branches`; tracked schema
    // and defer calls run in registration order.
    this.schema.alterTable("branches", (table) => {
      // SET NULL: deleting an organisational level leaves its children as roots.
      table.foreign("parent_branch_id").references("id").inTable("branches").onDelete("SET NULL");
    });
    for (const referencingTable of REFERENCING_TABLES) {
      this.schema.alterTable(referencingTable, (table) => {
        // CASCADE: subjects, opening hours and waiting-list entries are configuration of the
        // branch and go with it.
        table.foreign("branch_id").references("id").inTable("branches").onDelete("CASCADE");
      });
    }
  }

  override async down() {
    for (const referencingTable of REFERENCING_TABLES) {
      this.schema.alterTable(referencingTable, (table) => {
        table.dropForeign(["branch_id"]);
      });
    }
    this.schema.dropTable("branch_periods");
    this.schema.dropTable("branches");
  }
}
