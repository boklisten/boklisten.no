import type { QueryClientContract } from "@adonisjs/lucid/types/database";
import { ObjectId } from "bson";
import type { Document, Filter } from "mongodb";
import mongoose from "mongoose";
import type { Connection } from "mongoose";

import env from "#start/env";

/**
 * Shared pieces for the migrations that move a MongoDB collection into Postgres
 * (`docs/postgres-migration-plan.md`). A transfer migration creates its tables with `this.schema`,
 * then inside `this.defer` calls `withMongo` and, per collection, `transferCollection` with a mapping
 * function, `assertRowCount` and `dropCollection`.
 *
 * Lucid runs every migration inside one Postgres transaction, and the client handed to the `defer`
 * callback is that transaction, so a failed transfer leaves Postgres exactly as before and the
 * migration is retried on the next deploy. Mongo is only dropped after the counts match.
 */

export type Row = Record<string, unknown>;

/**
 * The driver database handle, typed through mongoose so it matches the driver version mongoose
 * bundles (the direct `mongodb` dependency may be a different minor).
 */
export type Db = NonNullable<Connection["db"]>;

interface MappedDocument {
  row: Row;
  /** Child rows keyed by table, inserted right after the batch their parents belong to. */
  children?: Record<string, Row[]>;
}

export type MapResult = MappedDocument | { skip: string };

interface TransferResult {
  migrated: number;
  skipped: number;
  /** Skip count per reason, in the order the reasons were first seen. */
  skippedBy: Record<string, number>;
  /** Rows inserted per child table. */
  children: Record<string, number>;
}

/** Source of documents for `transferCollection`; `Db` from the driver satisfies it. */
export interface DocumentSource {
  collection: (name: string) => {
    find: (filter?: Filter<Document>) => AsyncIterable<Document>;
  };
}

export function skip(reason: string): { skip: string } {
  return { skip: reason };
}

/**
 * Opens a dedicated Mongo connection to the database the running environment uses and closes it
 * when `fn` settles. The test environment has no Mongo, so callers guard with
 * `if (env.get("API_ENV") === "test") return;` before calling this.
 */
export async function withMongo<T>(fn: (mongo: Db) => Promise<T>): Promise<T> {
  const connection = await mongoose
    .createConnection(env.get("MONGODB_URI"), {
      dbName: env.get("API_ENV") === "production" ? "production" : "staging",
    })
    .asPromise();
  try {
    const mongo = connection.db;
    if (!mongo) {
      throw new Error("mongoose connection has no db handle");
    }
    return await fn(mongo);
  } finally {
    await connection.close();
  }
}

/**
 * The 24-character hex form of a Mongo id, or `null` for a missing value. Anything else is a
 * malformed reference the survey should have classified; failing loudly beats storing garbage in a
 * column that is about to become a foreign key.
 */
export function hexId(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof ObjectId || isObjectIdLike(value)) {
    return value.toHexString();
  }
  if (typeof value === "string" && /^[0-9a-fA-F]{24}$/.test(value)) {
    return value.toLowerCase();
  }
  throw new TypeError(`not a Mongo id: ${JSON.stringify(value)}`);
}

/** Like `hexId`, for references the target schema requires. */
export function requiredHexId(value: unknown, field: string): string {
  const id = hexId(value);
  if (id === null) {
    throw new TypeError(`missing required id in ${field}`);
  }
  return id;
}

function isObjectIdLike(value: unknown): value is { toHexString: () => string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "_bsontype" in value &&
    value._bsontype === "ObjectId" &&
    "toHexString" in value &&
    typeof value.toHexString === "function"
  );
}

/**
 * `creationTime`/`lastUpdated` of a legacy document as a `Date`, falling back to the timestamp
 * embedded in its ObjectId when the field is missing or unparseable. Legacy documents stored some
 * dates as strings before `1788117209148_normalize_legacy_mongo_dates_and_flags` ran, so strings
 * are still accepted.
 */
export function timestampOf(document: Document, field: "creationTime" | "lastUpdated"): Date {
  const value: unknown = document[field];
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  if (field === "lastUpdated" && document["creationTime"] !== undefined) {
    return timestampOf(document, "creationTime");
  }
  const id = hexId(document["_id"]);
  if (id === null) {
    throw new TypeError("document has no _id to derive a timestamp from");
  }
  return new ObjectId(id).getTimestamp();
}

/** The `created_at`/`updated_at` pair every migrated table carries. */
export function timestampsOf(document: Document): { created_at: Date; updated_at: Date } {
  return {
    created_at: timestampOf(document, "creationTime"),
    updated_at: timestampOf(document, "lastUpdated"),
  };
}

/**
 * Streams a collection through `map` and inserts the rows in batches. Parent rows carry their Mongo
 * id as primary key, so child rows can reference them before anything is inserted; each batch of
 * parents is followed by its children. Prints the summary line the plan asks for.
 */
export async function transferCollection({
  mongo,
  database,
  collection,
  table,
  map,
  filter = {},
  batchSize = 500,
}: {
  mongo: DocumentSource;
  database: QueryClientContract;
  collection: string;
  table: string;
  map: (document: Document) => MapResult | Promise<MapResult>;
  filter?: Filter<Document>;
  batchSize?: number;
}): Promise<TransferResult> {
  const result: TransferResult = { migrated: 0, skipped: 0, skippedBy: {}, children: {} };
  let rows: Row[] = [];
  let children: Record<string, Row[]> = {};

  async function flush() {
    if (rows.length === 0) {
      return;
    }
    await database.table(table).multiInsert(rows);
    result.migrated += rows.length;
    rows = [];
    for (const [childTable, childRows] of Object.entries(children)) {
      // A parent batch can carry many more child rows than parents (orders have up to 32 lines),
      // so children are chunked too, keeping every statement under the bind-parameter limit.
      for (let start = 0; start < childRows.length; start += batchSize) {
        const chunk = childRows.slice(start, start + batchSize);
        await database.table(childTable).multiInsert(chunk);
        result.children[childTable] = (result.children[childTable] ?? 0) + chunk.length;
      }
    }
    children = {};
  }

  for await (const document of mongo.collection(collection).find(filter)) {
    const mapped = await map(document);
    if ("skip" in mapped) {
      result.skipped++;
      result.skippedBy[mapped.skip] = (result.skippedBy[mapped.skip] ?? 0) + 1;
      continue;
    }
    rows.push(mapped.row);
    for (const [childTable, childRows] of Object.entries(mapped.children ?? {})) {
      (children[childTable] ??= []).push(...childRows);
    }
    if (rows.length >= batchSize) {
      await flush();
    }
  }
  await flush();

  console.log(summaryLine(table, result));
  return result;
}

export function summaryLine(table: string, result: TransferResult): string {
  const reasons = Object.entries(result.skippedBy)
    .map(([reason, count]) => `${count} ${reason}`)
    .join(", ");
  const children = Object.entries(result.children)
    .map(([childTable, count]) => `; ${childTable}: migrated ${count}`)
    .join("");
  return `${table}: migrated ${result.migrated}, skipped ${result.skipped}${reasons ? ` (${reasons})` : ""}${children}`;
}

/** Fails the migration (and rolls back its transaction) when the table does not hold `expected` rows. */
export async function assertRowCount(
  database: QueryClientContract,
  table: string,
  expected: number,
): Promise<void> {
  const [row] = await database.from(table).count("* as total");
  const actual = Number(row?.["total"] ?? Number.NaN);
  if (actual !== expected) {
    throw new Error(`${table}: expected ${expected} rows after transfer, found ${actual}`);
  }
}

/**
 * Drops a Mongo collection, tolerating one that is already gone. The old backend may recreate a
 * dropped collection with a few documents in the minutes before Railway switches traffic; a later
 * defensive drop removes those too, which is the accepted loss the plan describes.
 */
export async function dropCollection(mongo: Db, name: string): Promise<void> {
  try {
    await mongo.dropCollection(name);
    console.log(`${name}: mongo collection dropped`);
  } catch (error: unknown) {
    const alreadyGone =
      typeof error === "object" &&
      error !== null &&
      "codeName" in error &&
      error.codeName === "NamespaceNotFound";
    if (!alreadyGone) {
      throw error;
    }
    console.log(`${name}: mongo collection already gone`);
  }
}
