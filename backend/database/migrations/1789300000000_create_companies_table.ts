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
 * Step 2 of `docs/postgres-migration-plan.md`: the companies we invoice by hand (schools and
 * municipalities buying books outright) move from MongoDB to Postgres, keeping their Mongo ids.
 *
 * Schema fixes made on the way, backed by the staging survey recorded in the plan: the
 * `contactInfo` subdocument is flattened, every text column is `not null` (all 24 documents had
 * every field filled and the validator has always required them), and the meta fields `user`,
 * `editableFor`, `viewableFor` and `active` (always `true`) are dropped. Nothing references
 * companies yet: `invoices.customerInfo.companyDetail` is null on every invoice, so step 12 adds
 * `invoices.company_id` as a nullable key.
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("companies", (table) => {
      table.string("id", 24).primary();
      table.text("name").notNullable();
      table.text("phone").notNullable();
      table.text("email").notNullable();
      table.text("address").notNullable();
      table.text("post_code").notNullable();
      table.text("post_city").notNullable();
      // The customer number in our accounting system; today always the organization number.
      table.text("customer_number").notNullable();
      // Not unique: two companies can share an invoice centre (Oslo kommune and Ullern vgs do).
      table.text("organization_number").notNullable();

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
          collection: "companies",
          table: "companies",
          map: mapCompany,
        });
        await assertRowCount(database, "companies", migrated);
        await dropCollection(mongo, "companies");
      });
    });
  }

  override async down() {
    this.schema.dropTable("companies");
  }
}

function mapCompany(document: Document): MapResult {
  const id = requiredHexId(document["_id"], "companies._id");
  const contactInfo: Record<string, unknown> = isRecord(document["contactInfo"])
    ? document["contactInfo"]
    : {};
  return {
    row: {
      id,
      name: requiredString(document["name"], `companies.${id}.name`),
      phone: requiredString(contactInfo["phone"], `companies.${id}.contactInfo.phone`),
      email: requiredString(
        contactInfo["email"],
        `companies.${id}.contactInfo.email`,
      ).toLowerCase(),
      address: requiredString(contactInfo["address"], `companies.${id}.contactInfo.address`),
      post_code: requiredString(contactInfo["postCode"], `companies.${id}.contactInfo.postCode`),
      post_city: requiredString(contactInfo["postCity"], `companies.${id}.contactInfo.postCity`),
      customer_number: requiredString(document["customerNumber"], `companies.${id}.customerNumber`),
      organization_number: requiredString(
        document["organizationNumber"],
        `companies.${id}.organizationNumber`,
      ),
      ...timestampsOf(document),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Two surveyed documents carry a leading space in their organization and customer numbers (they
 * predate the schema's `trim`), so every string is trimmed on the way over.
 */
function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${field}: expected a non-empty string, got ${JSON.stringify(value)}`);
  }
  return value.trim();
}
