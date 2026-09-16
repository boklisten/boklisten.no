import { test } from "@japa/runner";
import db from "@adonisjs/lucid/services/db";
import { ObjectId } from "bson";
import type { Document } from "mongodb";

import {
  assertRowCount,
  hexId,
  requiredHexId,
  skip,
  summaryLine,
  timestampOf,
  timestampsOf,
  transferCollection,
} from "#database/helpers/mongo_transfer";
import type { Db, DocumentSource } from "#database/helpers/mongo_transfer";
import { mock } from "#tests/test-doubles";

const ID = "6100000000000000000000a1";

// Compile-time check: the driver's database handle is a valid document source for migrations.
const driverHandleIsASource: DocumentSource = mock<Db>();
void driverHandleIsASource;

function source(documents: Document[]): DocumentSource {
  return {
    collection: () => ({
      async *find() {
        yield* documents;
      },
    }),
  };
}

test.group("hexId", () => {
  test("accepts ObjectId instances and hex strings, null for missing", ({ assert }) => {
    assert.equal(hexId(new ObjectId(ID)), ID);
    assert.equal(hexId(ID), ID);
    assert.equal(hexId(ID.toUpperCase()), ID);
    assert.isNull(hexId(null));
    assert.isNull(hexId(undefined));
  });

  test("accepts ObjectId-like values from another bson copy", ({ assert }) => {
    assert.equal(hexId({ _bsontype: "ObjectId", toHexString: () => ID }), ID);
  });

  test("throws on malformed references", ({ assert }) => {
    assert.throws(() => hexId("not-an-id"), /not a Mongo id/);
    assert.throws(() => hexId(42), /not a Mongo id/);
    assert.throws(() => hexId({}), /not a Mongo id/);
  });

  test("requiredHexId names the field when the id is missing", ({ assert }) => {
    assert.equal(requiredHexId(ID, "customer"), ID);
    assert.throws(() => requiredHexId(undefined, "customer"), /missing required id in customer/);
  });
});

test.group("timestampOf", () => {
  const created = new Date("2024-08-01T10:00:00Z");
  const updated = new Date("2024-09-01T10:00:00Z");

  test("uses the document fields when present", ({ assert }) => {
    const document = { _id: new ObjectId(ID), creationTime: created, lastUpdated: updated };
    assert.deepEqual(timestampsOf(document), { created_at: created, updated_at: updated });
  });

  test("parses legacy string dates", ({ assert }) => {
    const document = { _id: new ObjectId(ID), creationTime: "2024-08-01T10:00:00.000Z" };
    assert.deepEqual(timestampOf(document, "creationTime"), created);
  });

  test("falls back from lastUpdated to creationTime, then to the ObjectId timestamp", ({
    assert,
  }) => {
    assert.deepEqual(
      timestampOf({ _id: new ObjectId(ID), creationTime: created }, "lastUpdated"),
      created,
    );
    const fromId = new ObjectId(ID).getTimestamp();
    assert.deepEqual(timestampsOf({ _id: new ObjectId(ID) }), {
      created_at: fromId,
      updated_at: fromId,
    });
    assert.deepEqual(timestampOf({ _id: ID, creationTime: "garbage" }, "creationTime"), fromId);
  });
});

test.group("transferCollection", (group) => {
  group.setup(async () => {
    await db.connection().schema.createTable("transfer_spec_parents", (table) => {
      table.string("id", 24).primary();
      table.string("name").notNullable();
    });
    await db.connection().schema.createTable("transfer_spec_children", (table) => {
      table.increments("id");
      table
        .string("parent_id", 24)
        .notNullable()
        .references("id")
        .inTable("transfer_spec_parents")
        .onDelete("CASCADE");
      table.integer("position").notNullable();
    });
    return async () => {
      await db.connection().schema.dropTable("transfer_spec_children");
      await db.connection().schema.dropTable("transfer_spec_parents");
    };
  });

  group.each.setup(async () => {
    await db.rawQuery("TRUNCATE transfer_spec_children, transfer_spec_parents");
  });

  test("inserts parents in batches with their children and counts skips per reason", async ({
    assert,
  }) => {
    const documents = Array.from({ length: 7 }, (_, index) => ({
      _id: new ObjectId(),
      name: `doc ${index}`,
      lines: index % 3 === 0 ? [] : [{}, {}],
    }));
    const result = await transferCollection({
      mongo: source([...documents, { _id: new ObjectId(), name: "" }, { _id: new ObjectId() }]),
      database: db.connection(),
      collection: "whatever",
      table: "transfer_spec_parents",
      batchSize: 3,
      map(document) {
        if (!document["name"]) {
          return skip("no name");
        }
        const id = requiredHexId(document["_id"], "_id");
        return {
          row: { id, name: document["name"] },
          children: {
            transfer_spec_children: Array.from(
              { length: Array.isArray(document["lines"]) ? document["lines"].length : 0 },
              (_, position) => ({ parent_id: id, position }),
            ),
          },
        };
      },
    });

    assert.deepEqual(result, {
      migrated: 7,
      skipped: 2,
      skippedBy: { "no name": 2 },
      children: { transfer_spec_children: 8 },
    });
    await assertRowCount(db.connection(), "transfer_spec_parents", 7);
    await assertRowCount(db.connection(), "transfer_spec_children", 8);
    const rows = await db.from("transfer_spec_parents").select("name").orderBy("name");
    assert.deepEqual(
      rows.map((row) => row["name"]),
      documents.map((document) => document.name),
    );
  });

  test("assertRowCount throws on a mismatch", async ({ assert }) => {
    await assert.rejects(
      () => assertRowCount(db.connection(), "transfer_spec_parents", 1),
      /transfer_spec_parents: expected 1 rows after transfer, found 0/,
    );
  });

  test("summary line follows the plan's format", ({ assert }) => {
    assert.equal(
      summaryLine("orders", {
        migrated: 10,
        skipped: 3,
        skippedBy: { "missing customer": 2, "missing branch": 1 },
        children: { order_items: 25 },
      }),
      "orders: migrated 10, skipped 3 (2 missing customer, 1 missing branch); order_items: migrated 25",
    );
    assert.equal(
      summaryLine("items", { migrated: 685, skipped: 0, skippedBy: {}, children: {} }),
      "items: migrated 685, skipped 0",
    );
  });
});
