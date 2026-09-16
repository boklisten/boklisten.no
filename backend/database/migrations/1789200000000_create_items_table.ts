import { BaseSchema } from "@adonisjs/lucid/schema";
import type { Document } from "mongodb";

import {
  assertRowCount,
  dropCollection,
  requiredHexId,
  timestampsOf,
  transferCollection,
  withMongo,
} from "#database/helpers/mongo_transfer";
import type { MapResult } from "#database/helpers/mongo_transfer";
import env from "#start/env";

/**
 * Step 1 of `docs/postgres-migration-plan.md`: the book catalogue (`items`) moves from MongoDB to
 * Postgres, keeping its Mongo ids as primary keys, and the four existing columns that already hold
 * item ids become real foreign keys.
 *
 * Schema fixes made on the way (all backed by the staging survey recorded in the plan): the `info`
 * subdocument is flattened, `weight` becomes a nullable number in kilograms (legacy `"?"` means
 * unknown), the year-keyed `info.price` map becomes `price_history` jsonb, and the meta fields
 * `user`, `editableFor`, `viewableFor` plus the never-read `taxRate` are dropped. `active` stays:
 * roughly half the catalogue is inactive and customers must not see those titles.
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("items", (table) => {
      table.string("id", 24).primary();
      table.text("title").notNullable();
      // Whole NOK.
      table.integer("price").notNullable();
      // 13-digit ISBNs exceed int4. The pg driver returns int8 as a string; the model converts.
      table.bigInteger("isbn").notNullable().unique();
      table.text("subject").notNullable();
      table.integer("year").notNullable();
      // Kilograms; NULL when unknown.
      table.double("weight").nullable();
      table.text("distributor").notNullable();
      // Fraction between 0 and 1.
      table.double("discount").notNullable();
      table.text("publisher").notNullable();
      // Inactive titles are hidden from customers and from the default book grid filter.
      table.boolean("active").notNullable().defaultTo(true);
      table.boolean("buyback").notNullable().defaultTo(false);
      // { "<calendar year>": price }: what the book cost each year, shown as history in the form.
      table.jsonb("price_history").notNullable().defaultTo("{}");

      table.timestamp("created_at");
      table.timestamp("updated_at");
    });

    this.defer(async (database) => {
      if (env.get("API_ENV") === "test") {
        return;
      }
      await withMongo(async (mongo) => {
        const { migrated } = await transferCollection({
          mongo,
          database,
          collection: "items",
          table: "items",
          map: mapItem,
        });
        await assertRowCount(database, "items", migrated);
        await dropCollection(mongo, "items");
      });
    });

    // The referencing rows already exist, so the keys can only be added once the transfer above
    // has filled `items` (tracked schema and defer calls run in registration order). RESTRICT: an
    // item with history must never be deleted; item deletion is not a feature.
    for (const referencingTable of REFERENCING_TABLES) {
      this.schema.alterTable(referencingTable, (table) => {
        table.foreign("item_id").references("id").inTable("items").onDelete("RESTRICT");
      });
    }
  }

  override async down() {
    for (const referencingTable of REFERENCING_TABLES) {
      this.schema.alterTable(referencingTable, (table) => {
        table.dropForeign(["item_id"]);
      });
    }
    this.schema.dropTable("items");
  }
}

const REFERENCING_TABLES = [
  "branch_subject_books",
  "match_obligations",
  "book_handovers",
  "waiting_list_customers",
];

function mapItem(document: Document): MapResult {
  const id = requiredHexId(document["_id"], "items._id");
  const info: Record<string, unknown> = isRecord(document["info"]) ? document["info"] : {};
  return {
    row: {
      id,
      title: requiredString(document["title"], `items.${id}.title`),
      price: requiredInteger(document["price"], `items.${id}.price`),
      isbn: requiredInteger(info["isbn"], `items.${id}.info.isbn`),
      subject: requiredString(info["subject"], `items.${id}.info.subject`),
      year: requiredInteger(info["year"], `items.${id}.info.year`),
      weight: weightInKilograms(info["weight"], `items.${id}.info.weight`),
      distributor: requiredString(info["distributor"], `items.${id}.info.distributor`),
      discount: requiredNumber(info["discount"], `items.${id}.info.discount`),
      publisher: requiredString(info["publisher"], `items.${id}.info.publisher`),
      active: document["active"] !== false,
      buyback: document["buyback"] === true,
      price_history: JSON.stringify(priceHistory(info["price"], id)),
      ...timestampsOf(document),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${field}: expected a non-empty string, got ${JSON.stringify(value)}`);
  }
  return value.trim();
}

function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new TypeError(`${field}: expected a number, got ${JSON.stringify(value)}`);
  }
  return value;
}

function requiredInteger(value: unknown, field: string): number {
  const number = requiredNumber(value, field);
  if (!Number.isInteger(number)) {
    throw new TypeError(`${field}: expected an integer, got ${number}`);
  }
  return number;
}

/**
 * Legacy weights are kilograms stored as either a string or a number; `"?"` is the surveyed way of
 * saying unknown. Anything else is unsurveyed data and fails the transfer rather than becoming NULL.
 */
function weightInKilograms(value: unknown, field: string): number | null {
  if (typeof value === "string" && value.trim() === "?") {
    return null;
  }
  if (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value.trim())) {
    return Number(value.trim());
  }
  return requiredNumber(value, field);
}

/** The Mongoose `Map<string, number>` arrives from the driver as a plain object keyed by year. */
function priceHistory(value: unknown, id: string): Record<string, number> {
  if (!isRecord(value)) {
    throw new TypeError(`items.${id}.info.price: expected a year → price map`);
  }
  return Object.fromEntries(
    Object.entries(value).map(([year, price]) => [
      year,
      requiredInteger(price, `items.${id}.info.price.${year}`),
    ]),
  );
}
