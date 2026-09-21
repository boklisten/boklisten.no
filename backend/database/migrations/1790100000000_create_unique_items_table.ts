import { BaseSchema } from "@adonisjs/lucid/schema";
import type { Document } from "mongodb";

import {
  assertRowCount,
  dropCollection,
  requiredHexId,
  skip,
  timestampsOf,
  transferCollection,
  withMongo,
} from "#database/helpers/mongo_transfer";
import type { MapResult } from "#database/helpers/mongo_transfer";
import env from "#start/env";

/**
 * A blid as printed on the stickers: 12 alphanumeric characters from Unike IDer, 8 digits on the
 * oldest labels, and one 2022 batch of 8 alphanumeric characters. The registration validator only
 * accepts the first two; the constraint also admits the third so the 2022 batch can move over.
 */
const BLID_FORMAT = /^[\dA-Za-z]{8}$|^[\dA-Za-z]{12}$/;

/**
 * Step 7 of `docs/postgres-migration-plan.md`: the unique items (the registry that says which
 * book a blid sticker sits on) move from MongoDB to Postgres, keeping their Mongo ids.
 *
 * Schema fixes made on the way, backed by the staging survey recorded in the plan: the `title`
 * snapshot is dropped (547 of them had drifted from the catalogue, mostly trailing spaces; the
 * title is read from `items`), `item` becomes a real foreign key, and the meta fields `user`,
 * `editableFor`, `viewableFor` and `active` (never false) are dropped. The blid format is
 * enforced with a check constraint. Two kinds of documents are left behind, both decided in the
 * plan's step 7 section: the 7 blids whose item was deleted from the catalogue years ago, and the
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

      table.check(
        `blid ~ '^[0-9A-Za-z]{8}$|^[0-9A-Za-z]{12}$'`,
        undefined,
        "unique_items_blid_format",
      );
    });

    this.defer(async (database) => {
      if (env.get("API_ENV") === "test") {
        return;
      }
      const catalogue = new Set<string>(
        (await database.from("items").select("id")).map((row: { id: string }) => row.id),
      );
      await withMongo(async (mongo) => {
        const { migrated } = await transferCollection({
          mongo,
          database,
          collection: "uniqueitems",
          table: "unique_items",
          map: (document) => mapUniqueItem(document, catalogue),
        });
        await assertRowCount(database, "unique_items", migrated);
        await dropCollection(mongo, "uniqueitems");
      });
    });
  }

  override async down() {
    this.schema.dropTable("unique_items");
  }
}

function mapUniqueItem(document: Document, catalogue: Set<string>): MapResult {
  const id = requiredHexId(document["_id"], "uniqueitems._id");
  const blid: unknown = document["blid"];
  if (typeof blid !== "string" || !BLID_FORMAT.test(blid)) {
    console.log(`uniqueitems.${id}: blid ${JSON.stringify(blid)} is malformed, dropped`);
    return skip("malformed blid");
  }
  const itemId = requiredHexId(document["item"], `uniqueitems.${id}.item`);
  if (!catalogue.has(itemId)) {
    console.log(`uniqueitems.${id}: item ${itemId} is no longer in the catalogue, dropped`);
    return skip("item no longer in the catalogue");
  }
  return {
    row: {
      id,
      blid,
      item_id: itemId,
      ...timestampsOf(document),
    },
  };
}
