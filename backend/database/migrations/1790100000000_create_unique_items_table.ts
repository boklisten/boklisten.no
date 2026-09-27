import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Step 7 of the MongoDB → Postgres migration: the unique items (the registry that says which
 * book a blid sticker sits on) move from MongoDB to Postgres, keeping their Mongo ids.
 *
 * Schema fixes made on the way, backed by a staging survey: the `title`
 * snapshot is dropped (547 of them had drifted from the catalogue, mostly trailing spaces; the
 * title is read from `items`), `item` becomes a real foreign key, and the meta fields `user`,
 * `editableFor`, `viewableFor` and `active` (never false) are dropped. The blid format is
 * enforced with a check constraint. Two kinds of documents are left behind, both decided after
 * the staging survey: the 7 blids whose item was deleted from the catalogue years ago, and the
 * 18 mis-scans whose blid contains symbols, spaces or Norwegian letters (or is a 13-digit ISBN).
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("unique_items", (table) => {
      table.string("id", 24).primary();
      table.text("blid").notNullable().unique();
      // RESTRICT: a title with stickers in circulation cannot be deleted from the catalogue.
      table
        .string("item_id", 24)
        .notNullable()
        .references("id")
        .inTable("items")
        .onDelete("RESTRICT")
        .index();

      table.timestamp("created_at");
      table.timestamp("updated_at");

      // A blid as printed on the stickers: 12 alphanumeric characters from Unike IDer, 8 digits on
      // the oldest labels, and one 2022 batch of 8 alphanumeric characters.
      table.check(
        `blid ~ '^[0-9A-Za-z]{8}$|^[0-9A-Za-z]{12}$'`,
        undefined,
        "unique_items_blid_format",
      );
    });

    // The MongoDB transfer that ran here (2026-09-21) was removed on 2026-09-28.
  }

  override async down() {
    this.schema.dropTable("unique_items");
  }
}
