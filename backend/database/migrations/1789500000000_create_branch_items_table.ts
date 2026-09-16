import { BaseSchema } from "@adonisjs/lucid/schema";
import type { Document } from "mongodb";
import type { QueryClientContract } from "@adonisjs/lucid/types/database";

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
 * Step 4 of `docs/postgres-migration-plan.md`: the branch items (which titles a branch offers,
 * how they may be ordered online and handed out at the branch, and the subjects they are listed
 * under) move from MongoDB to Postgres, keeping their Mongo ids.
 *
 * Schema fixes made on the way, backed by the staging survey recorded in the plan: `sell`,
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

    this.defer(async (database) => {
      if (env.get("API_ENV") === "test") {
        return;
      }
      await withMongo(async (mongo) => {
        const [branchIds, itemIds] = await Promise.all([
          idsOf(database, "branches"),
          idsOf(database, "items"),
        ]);
        const { migrated } = await transferCollection({
          mongo,
          database,
          collection: "branchitems",
          table: "branch_items",
          map: (document) => mapBranchItem(document, branchIds, itemIds),
        });
        await assertRowCount(database, "branch_items", migrated);
        await dropCollection(mongo, "branchitems");
      });
    });
  }

  override async down() {
    this.schema.dropTable("branch_items");
  }
}

async function idsOf(database: QueryClientContract, table: string): Promise<Set<string>> {
  const rows = await database.from(table).select("id");
  return new Set(rows.map((row: { id: string }) => row.id));
}

/**
 * The staging survey (2026-09-16) found every `branch` and `item` reference intact; should
 * production differ, an entry pointing at a deleted branch or item is dropped and counted in the
 * summary line, since it cannot be shown or ordered anyway.
 */
function mapBranchItem(
  document: Document,
  branchIds: Set<string>,
  itemIds: Set<string>,
): MapResult {
  const id = requiredHexId(document["_id"], "branchitems._id");
  const branchId = requiredHexId(document["branch"], `branchitems.${id}.branch`);
  const itemId = requiredHexId(document["item"], `branchitems.${id}.item`);
  if (!branchIds.has(branchId)) {
    console.log(`branchitems.${id}: branch ${branchId} does not exist, dropped`);
    return skip("branch deleted");
  }
  if (!itemIds.has(itemId)) {
    console.log(`branchitems.${id}: item ${itemId} does not exist, dropped`);
    return skip("item deleted");
  }
  return {
    row: {
      id,
      branch_id: branchId,
      item_id: itemId,
      rent: document["rent"] === true,
      partly_payment: document["partlyPayment"] === true,
      buy: document["buy"] === true,
      rent_at_branch: document["rentAtBranch"] === true,
      partly_payment_at_branch: document["partlyPaymentAtBranch"] === true,
      buy_at_branch: document["buyAtBranch"] === true,
      categories: categoriesOf(document["categories"], `branchitems.${id}.categories`),
      ...timestampsOf(document),
    },
  };
}

/** Non-empty trimmed names, deduplicated; the survey found no blanks or duplicates, so this is a guard. */
function categoriesOf(value: unknown, field: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new TypeError(`${field}: expected an array, got ${typeof value}`);
  }
  const names = value.map((entry: unknown) => {
    if (typeof entry !== "string") {
      throw new TypeError(`${field}: expected strings, got ${typeof entry}`);
    }
    return entry.trim();
  });
  return [...new Set(names.filter((name) => name.length > 0))];
}
