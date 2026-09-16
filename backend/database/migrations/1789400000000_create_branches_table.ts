import { BaseSchema } from "@adonisjs/lucid/schema";
import type { Document } from "mongodb";

import {
  assertRowCount,
  dropCollection,
  hexId,
  requiredHexId,
  timestampsOf,
  transferCollection,
  withMongo,
} from "#database/helpers/mongo_transfer";
import type { Db, MapResult, Row } from "#database/helpers/mongo_transfer";
import env from "#start/env";

/**
 * Step 3 of `docs/postgres-migration-plan.md`: the branches (schools, their year groups and
 * classes, privatist schools, the web shop) move from MongoDB to Postgres, keeping their Mongo ids,
 * together with their payment periods, which become the child table `branch_periods`. The three
 * existing columns that already hold branch ids become real foreign keys.
 *
 * Schema fixes made on the way, backed by the staging survey recorded in the plan: the
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

    this.defer(async (database) => {
      if (env.get("API_ENV") === "test") {
        return;
      }
      await withMongo(async (mongo) => {
        const parents = await parentByBranch(mongo);
        const discrepancies = { missingParent: 0, childNotClaimingParent: 0, regionFixed: 0 };
        const { migrated } = await transferCollection({
          mongo,
          database,
          collection: "branches",
          table: "branches",
          map: (document) => mapBranch(document, parents, discrepancies),
        });
        console.log(
          `branches: ${discrepancies.missingParent} parent references to deleted branches set to null, ` +
            `${discrepancies.childNotClaimingParent} childBranches entries whose child names another parent (parentBranch wins), ` +
            `${discrepancies.regionFixed} regions filled in by hand`,
        );
        await assertRowCount(database, "branches", migrated);
        await dropCollection(mongo, "branches");
      });
    });

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

const REFERENCING_TABLES = ["branch_subjects", "opening_hours", "waiting_list_customers"];

const PERIOD_KINDS = ["partly_payment", "rent", "extend"] as const;

/** The Mongo array each period kind comes from. */
const PERIOD_SOURCES: Record<(typeof PERIOD_KINDS)[number], string> = {
  partly_payment: "partlyPaymentPeriods",
  rent: "rentPeriods",
  extend: "extendPeriods",
};

/**
 * Surveyed 2026-09-16: exactly one branch, the inactive "Sonans Lillestrøm", lacks
 * `location.region` (its address is "Kirkegata 3, 2000 Lillestrøm"). Decided with Adrian: fill it
 * in here rather than making the column nullable for one document.
 */
const REGION_FIXES: Record<string, string> = {
  "5d4d4f1400a2ff001c65f98d": "Lillestrøm",
};

interface Discrepancies {
  missingParent: number;
  childNotClaimingParent: number;
  regionFixed: number;
}

/** Every branch's `parentBranch`, keyed by branch id, for the consistency checks in `mapBranch`. */
async function parentByBranch(mongo: Db): Promise<Map<string, string | null>> {
  const documents = await mongo
    .collection("branches")
    .find({}, { projection: { _id: 1, parentBranch: 1 } })
    .toArray();
  return new Map(
    documents.map((document) => [
      requiredHexId(document._id, "branches._id"),
      parentIdOf(document),
    ]),
  );
}

/** Legacy documents may hold `""` where an ObjectId or null belongs. */
function parentIdOf(document: Document): string | null {
  const value: unknown = document["parentBranch"];
  return value === "" ? null : hexId(value);
}

function mapBranch(
  document: Document,
  parents: Map<string, string | null>,
  discrepancies: Discrepancies,
): MapResult {
  const id = requiredHexId(document["_id"], "branches._id");
  const paymentInfo = recordOf(document["paymentInfo"]);
  const location = recordOf(document["location"]);
  const deliveryMethods = recordOf(document["deliveryMethods"]);
  const live = recordOf(document["isBranchItemsLive"]);

  let parentBranchId = parentIdOf(document);
  if (parentBranchId !== null && !parents.has(parentBranchId)) {
    console.log(`branches.${id}: parentBranch ${parentBranchId} does not exist, set to null`);
    parentBranchId = null;
    discrepancies.missingParent++;
  }
  for (const child of arrayOf(document["childBranches"], `branches.${id}.childBranches`)) {
    const childId = hexId(child);
    if (childId !== null && parents.get(childId) !== id) {
      console.log(
        `branches.${id}: childBranches lists ${childId}, whose parentBranch is ${parents.get(childId) ?? "null"}`,
      );
      discrepancies.childNotClaimingParent++;
    }
  }

  let region = optionalString(location["region"], `branches.${id}.location.region`);
  if (region === null && id in REGION_FIXES) {
    region = REGION_FIXES[id] ?? null;
    discrepancies.regionFixed++;
  }
  if (region === null) {
    throw new TypeError(`branches.${id}.location.region: missing`);
  }

  return {
    row: {
      id,
      name: requiredString(document["name"], `branches.${id}.name`),
      logo: optionalString(document["logo"], `branches.${id}.logo`),
      type: branchType(document["type"], `branches.${id}.type`),
      parent_branch_id: parentBranchId,
      local_name: optionalString(document["localName"], `branches.${id}.localName`),
      child_label: optionalString(document["childLabel"], `branches.${id}.childLabel`),
      active: document["active"] !== false,
      payment_responsible: paymentInfo["responsible"] === true,
      responsible_for_delivery: paymentInfo["responsibleForDelivery"] === true,
      buyout_percentage: percentage(
        recordOf(paymentInfo["buyout"])["percentage"] ?? 1,
        `branches.${id}.paymentInfo.buyout.percentage`,
      ),
      sell_percentage: percentage(
        recordOf(paymentInfo["sell"])["percentage"] ?? 1,
        `branches.${id}.paymentInfo.sell.percentage`,
      ),
      delivery_at_branch: deliveryMethods["branch"] !== false,
      delivery_by_mail: deliveryMethods["byMail"] !== false,
      branch_items_live_online: live["online"] === true,
      branch_items_live_at_branch: live["atBranch"] === true,
      region,
      address: optionalString(location["address"], `branches.${id}.location.address`),
      ...timestampsOf(document),
    },
    children: { branch_periods: periodRows(id, paymentInfo) },
  };
}

function periodRows(branchId: string, paymentInfo: Record<string, unknown>): Row[] {
  const rows: Row[] = [];
  for (const kind of PERIOD_KINDS) {
    const source = PERIOD_SOURCES[kind];
    const entries = arrayOf(paymentInfo[source], `branches.${branchId}.paymentInfo.${source}`);
    for (const [index, entry] of entries.entries()) {
      const where = `branches.${branchId}.paymentInfo.${source}[${index}]`;
      const period = recordOf(entry);
      const row: Row = {
        branch_id: branchId,
        kind,
        period_type: periodType(period["type"], `${where}.type`),
        date: requiredDate(period["date"], `${where}.date`),
        max_number_of_periods: null,
        percentage: null,
        price: null,
        percentage_buyout: null,
        percentage_buyout_used: null,
        percentage_up_front: null,
        percentage_up_front_used: null,
      };
      switch (kind) {
        case "partly_payment": {
          row["percentage_buyout"] = percentage(
            period["percentageBuyout"],
            `${where}.percentageBuyout`,
          );
          row["percentage_buyout_used"] = percentage(
            period["percentageBuyoutUsed"],
            `${where}.percentageBuyoutUsed`,
          );
          row["percentage_up_front"] = percentage(
            period["percentageUpFront"],
            `${where}.percentageUpFront`,
          );
          row["percentage_up_front_used"] = percentage(
            period["percentageUpFrontUsed"],
            `${where}.percentageUpFrontUsed`,
          );
          break;
        }
        case "rent": {
          row["max_number_of_periods"] = requiredInteger(
            period["maxNumberOfPeriods"],
            `${where}.maxNumberOfPeriods`,
          );
          row["percentage"] = percentage(period["percentage"], `${where}.percentage`);
          break;
        }
        case "extend": {
          row["max_number_of_periods"] = requiredInteger(
            period["maxNumberOfPeriods"],
            `${where}.maxNumberOfPeriods`,
          );
          row["price"] = requiredInteger(period["price"], `${where}.price`);
          row["percentage"] =
            period["percentage"] === undefined || period["percentage"] === null
              ? null
              : percentage(period["percentage"], `${where}.percentage`);
          break;
        }
      }
      rows.push(row);
    }
  }
  return rows;
}

function recordOf(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- narrowed to a non-array object
      (value as Record<string, unknown>)
    : {};
}

function arrayOf(value: unknown, field: string): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new TypeError(`${field}: expected an array, got ${JSON.stringify(value)}`);
  }
  return value;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${field}: expected a non-empty string, got ${JSON.stringify(value)}`);
  }
  return value.trim();
}

/** Missing, null and empty strings all mean "not set". */
function optionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new TypeError(`${field}: expected a string, got ${JSON.stringify(value)}`);
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function branchType(value: unknown, field: string): "VGS" | "privatist" | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (value === "VGS" || value === "privatist") {
    return value;
  }
  throw new TypeError(`${field}: unexpected branch type ${JSON.stringify(value)}`);
}

function periodType(value: unknown, field: string): "semester" | "year" {
  if (value === "semester" || value === "year") {
    return value;
  }
  throw new TypeError(`${field}: unexpected period type ${JSON.stringify(value)}`);
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

/** A fraction of the item price; the survey found nothing outside 0..1. */
function percentage(value: unknown, field: string): number {
  const number = requiredNumber(value, field);
  if (number < 0 || number > 1) {
    throw new TypeError(`${field}: expected a fraction between 0 and 1, got ${number}`);
  }
  return number;
}

/**
 * Period dates are `Date` on most documents; nine entries on three Sonans branches predate the
 * date normalisation and hold ISO strings, which parse to the same instants.
 */
function requiredDate(value: unknown, field: string): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  throw new TypeError(`${field}: expected a date, got ${JSON.stringify(value)}`);
}
