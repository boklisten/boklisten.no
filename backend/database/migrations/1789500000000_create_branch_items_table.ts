import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Step 4 of the MongoDB → Postgres migration: the branch items (which titles a branch offers,
 * how they may be ordered online and handed out at the branch, and the subjects they are listed
 * under) move from MongoDB to Postgres, keeping their Mongo ids.
 *
 * Schema fixes made on the way, backed by a staging survey: `sell`,
 * `sellAtBranch`, `live` and `liveAtBranch` are dropped (false on all but six of 1 366 documents,
 * read by nothing, and overwritten to false by the only writer on every save); `categories` stays
 * as a `text[]` (non-empty on 1 358 documents; it drives the public catalog grouping and the
 * "Fag" tags on the branch's book list); the meta fields `active` (never false), `user`,
 * `editableFor` and `viewableFor` are dropped.
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("branch_items", (table) => {
      table.string("id", 24).primary();
      // CASCADE on both sides: an entry says "this branch offers this title" and means nothing
      // once either of them is gone.
      table
        .string("branch_id", 24)
        .notNullable()
        .references("id")
        .inTable("branches")
        .onDelete("CASCADE");
      table
        .string("item_id", 24)
        .notNullable()
        .references("id")
        .inTable("items")
        .onDelete("CASCADE");
      // What customers may order online.
      table.boolean("rent").notNullable().defaultTo(false);
      table.boolean("partly_payment").notNullable().defaultTo(false);
      table.boolean("buy").notNullable().defaultTo(false);
      // What employees may hand out at the branch.
      table.boolean("rent_at_branch").notNullable().defaultTo(false);
      table.boolean("partly_payment_at_branch").notNullable().defaultTo(false);
      table.boolean("buy_at_branch").notNullable().defaultTo(false);
      // The subjects the title is listed under in the branch's catalog, e.g. "Kjemi 2". Plain
      // names; the branch subjects tables are a separate, newer feature.
      table.specificType("categories", "text[]").notNullable().defaultTo("{}");

      table.timestamp("created_at");
      table.timestamp("updated_at");

      // Mirrors the Mongo index `branch_item_unique`; the branch prefix also serves the
      // "all items of a branch" lookups.
      table.unique(["branch_id", "item_id"]);
    });

    // The MongoDB transfer that ran here (2026-09-16) was removed on 2026-09-28.
  }

  override async down() {
    this.schema.dropTable("branch_items");
  }
}
