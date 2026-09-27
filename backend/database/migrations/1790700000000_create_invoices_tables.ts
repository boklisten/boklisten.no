import { BaseSchema } from "@adonisjs/lucid/schema";
import type { QueryClientContract } from "@adonisjs/lucid/types/database";
import { DateTime } from "luxon";
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
import type { MapResult, Row } from "#database/helpers/mongo_transfer";
import env from "#start/env";

/**
 * Step 12 of `docs/postgres-migration-plan.md`: invoices move from MongoDB to Postgres, keeping
 * their Mongo ids, and the embedded `customerItemPayments` array becomes `invoice_lines`.
 *
 * Invoices are accounting documents, so the customer as it was when the invoice was made stays on
 * the invoice as columns and outlives the customer: `customer_id` only links to the customer while
 * they exist. Schema fixes made on the way, backed by the staging survey recorded in the plan:
 * - `customerHavePayed` becomes `customer_has_paid`, `invoiceId` becomes `invoice_number`,
 *   `duedate` becomes `due_date`; `customerInfo`, `postal` and `payment` become columns.
 * - `customer_number` is the number the accounting systems know the customer by. Company invoices
 *   stored it; for pupils the exports derived it from the user id, which is gone once the user is
 *   deleted, so it is derived here once, with the same rules, and stored.
 * - The date of birth becomes a calendar day; the four impossible ones become NULL.
 * - `comments` becomes one `comment` column: only company invoices carry comments, one each, and
 *   never with a user.
 * - Dropped: `customerInfo.branchName` (every reader shows the branch's current name),
 *   `customerInfo.companyDetail` (never set), the line fields no document carries
 *   (`customerNumber`, `organizationNumber`), and the meta fields `user`, `editableFor`,
 *   `viewableFor` and `active` (never false).
 *
 * Orphans, decided in the plan's step 12 section: invoices of customers deleted by the old
 * three-year user cleanup keep their snapshot with `customer_id` NULL. Every branch, customer item
 * and book an invoice names exists.
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("invoices", (table) => {
      table.string("id", 24).primary();
      // Not unique: two 2020 company invoices were reissued under the credited invoice's number.
      table.text("invoice_number").notNullable();
      // "loan" is a legacy name for rent; company invoices and the oldest invoices have no type.
      table.enu("type", ["rent", "partly-payment", "loan"]).nullable();
      table.timestamp("due_date").notNullable();
      table.boolean("customer_has_paid").notNullable().defaultTo(false);
      table.boolean("to_credit_note").notNullable().defaultTo(false);
      table.boolean("to_debt_collection").notNullable().defaultTo(false);
      table.boolean("to_loss_note").notNullable().defaultTo(false);
      // SET NULL: an invoice is bookkeeping and outlives the branch. Company invoices have none.
      table
        .string("branch_id", 24)
        .nullable()
        .references("id")
        .inTable("branches")
        .onDelete("SET NULL");
      // SET NULL: an invoice is bookkeeping and outlives the customer; the columns below keep who
      // they were. Company invoices have none.
      table
        .string("customer_id", 24)
        .nullable()
        .references("id")
        .inTable("users")
        .onDelete("SET NULL");
      table.text("customer_number").notNullable();
      table.text("customer_name").notNullable();
      table.text("customer_email").notNullable();
      table.text("customer_phone").notNullable();
      table.date("customer_dob").nullable();
      // Only on company invoices, which is how they are told apart.
      table.text("customer_organization_number").nullable();
      table.text("customer_address").notNullable();
      table.text("customer_post_code").notNullable();
      table.text("customer_post_city").notNullable();
      // Only company invoices carry a country.
      table.text("customer_country").nullable();
      // Company invoices are written by hand in kroner and øre.
      table.decimal("total_gross", 10, 2).notNullable();
      table.decimal("total_net", 10, 2).notNullable();
      table.decimal("total_vat", 10, 2).notNullable();
      // The sum of the line discounts, not a percentage of the total.
      table.decimal("total_discount", 10, 2).notNullable();
      table.decimal("fee_unit", 10, 2).nullable();
      table.decimal("fee_gross", 10, 2).nullable();
      table.decimal("fee_net", 10, 2).nullable();
      table.decimal("fee_vat", 10, 2).nullable();
      table.decimal("fee_discount", 10, 2).nullable();
      table.decimal("total_including_fee", 10, 2).notNullable();
      table.text("reference").notNullable();
      table.text("our_reference").nullable();
      table.text("comment").nullable();
      table.timestamp("created_at").notNullable();
      table.timestamp("updated_at").notNullable();

      table.index(["invoice_number"]);
      table.index(["customer_id"]);
      table.index(["branch_id"]);
    });
    // Pupils' invoices carry the whole fee; company invoices carry none.
    this.schema.raw(
      "ALTER TABLE invoices ADD CONSTRAINT invoices_fee_complete CHECK (num_nonnulls(fee_unit, fee_gross, fee_net, fee_vat, fee_discount) IN (0, 5))",
    );

    this.schema.createTable("invoice_lines", (table) => {
      table.increments("id");
      // CASCADE: a line is part of its invoice.
      table
        .string("invoice_id", 24)
        .notNullable()
        .references("id")
        .inTable("invoices")
        .onDelete("CASCADE");
      table.smallint("position").notNullable();
      // SET NULL: the line keeps its title and amounts. Company invoice lines have none.
      table
        .string("customer_item_id", 24)
        .nullable()
        .references("id")
        .inTable("customer_items")
        .onDelete("SET NULL");
      // RESTRICT: the exported article number is derived from the book's id. Company invoice
      // lines have none.
      table.string("item_id", 24).nullable().references("id").inTable("items").onDelete("RESTRICT");
      table.enu("customer_item_type", ["rent", "partly-payment"]).nullable();
      table.text("title").notNullable();
      // Only on company invoice lines.
      table.integer("product_number").nullable();
      table.integer("number_of_items").notNullable();
      table.boolean("cancel").notNullable().defaultTo(false);
      table.decimal("unit", 10, 2).notNullable();
      table.decimal("gross", 10, 2).notNullable();
      table.decimal("net", 10, 2).notNullable();
      table.decimal("vat", 10, 2).notNullable();
      // In percent.
      table.decimal("discount", 10, 2).notNullable();

      table.unique(["invoice_id", "position"]);
      table.index(["customer_item_id"]);
      table.index(["item_id"]);
    });

    this.defer(async (database) => {
      if (env.get("API_ENV") === "test") {
        return;
      }
      const userIds = await allUserIds(database);
      const stats = { customerDeleted: 0, dobsCleared: 0 };
      await withMongo(async (mongo) => {
        const { migrated } = await transferCollection({
          mongo,
          database,
          collection: "invoices",
          table: "invoices",
          map: (document) => mapInvoice(document, userIds, stats),
        });
        console.log(
          `invoices: ${stats.customerDeleted} deleted customers set to null, ` +
            `${stats.dobsCleared} impossible dates of birth cleared`,
        );
        await assertRowCount(database, "invoices", migrated);
        await dropCollection(mongo, "invoices");
      });
    });
  }

  override async down() {
    this.schema.dropTable("invoice_lines");
    this.schema.dropTable("invoices");
  }
}

async function allUserIds(database: QueryClientContract): Promise<Set<string>> {
  const rows: { id: string }[] = await database.from("users").select("id");
  return new Set(rows.map((row) => row.id));
}

function mapInvoice(
  document: Document,
  userIds: Set<string>,
  stats: { customerDeleted: number; dobsCleared: number },
): MapResult {
  const id = requiredHexId(document["_id"], "invoices._id");
  const field = (name: string) => `invoices.${id}.${name}`;
  const customerInfo = objectOf(document["customerInfo"], field("customerInfo"));
  const postal = objectOf(customerInfo["postal"], field("customerInfo.postal"));
  const payment = objectOf(document["payment"], field("payment"));
  const total = objectOf(payment["total"], field("payment.total"));
  const fee: unknown = payment["fee"] ?? null;
  const feeColumns = fee === null ? null : objectOf(fee, field("payment.fee"));
  const timestamps = timestampsOf(document);

  const userDetailId = hexId(customerInfo["userDetail"]);
  const customerId = userDetailId !== null && userIds.has(userDetailId) ? userDetailId : null;
  if (userDetailId !== null && customerId === null) {
    stats.customerDeleted++;
  }
  const dob = calendarDate(customerInfo["dob"], field("customerInfo.dob"));
  if (dob.cleared) {
    stats.dobsCleared++;
  }

  const comments = Array.isArray(document["comments"]) ? document["comments"] : [];
  if (comments.length > 1) {
    throw new TypeError(`${field("comments")}: more than one comment`);
  }
  const lines: unknown[] = Array.isArray(document["customerItemPayments"])
    ? document["customerItemPayments"]
    : [];

  return {
    row: {
      id,
      invoice_number: requiredString(document["invoiceId"], field("invoiceId")),
      type: optionalEnum(document["type"], ["rent", "partly-payment", "loan"], field("type")),
      due_date: requiredDate(document["duedate"], field("duedate")),
      customer_has_paid: document["customerHavePayed"] === true,
      to_credit_note: document["toCreditNote"] === true,
      to_debt_collection: document["toDebtCollection"] === true,
      to_loss_note: document["toLossNote"] === true,
      branch_id: hexId(document["branch"]),
      customer_id: customerId,
      customer_number:
        userDetailId === null
          ? requiredString(customerInfo["customerNumber"], field("customerInfo.customerNumber"))
          : String(legacyCustomerNumber(userDetailId, timestamps.created_at)),
      customer_name: requiredString(customerInfo["name"], field("customerInfo.name")),
      customer_email: requiredString(customerInfo["email"], field("customerInfo.email")),
      customer_phone: requiredString(customerInfo["phone"], field("customerInfo.phone")),
      customer_dob: dob.value,
      customer_organization_number: optionalString(customerInfo["organizationNumber"]),
      customer_address: requiredString(postal["address"], field("customerInfo.postal.address")),
      customer_post_code: requiredString(postal["code"], field("customerInfo.postal.code")),
      customer_post_city: requiredString(postal["city"], field("customerInfo.postal.city")),
      customer_country: optionalString(postal["country"]),
      total_gross: amount(total["gross"], field("payment.total.gross")),
      total_net: amount(total["net"], field("payment.total.net")),
      total_vat: amount(total["vat"], field("payment.total.vat")),
      total_discount: amount(total["discount"], field("payment.total.discount")),
      fee_unit: feeColumns && amount(feeColumns["unit"], field("payment.fee.unit")),
      fee_gross: feeColumns && amount(feeColumns["gross"], field("payment.fee.gross")),
      fee_net: feeColumns && amount(feeColumns["net"], field("payment.fee.net")),
      fee_vat: feeColumns && amount(feeColumns["vat"], field("payment.fee.vat")),
      fee_discount: feeColumns && amount(feeColumns["discount"], field("payment.fee.discount")),
      total_including_fee: amount(payment["totalIncludingFee"], field("payment.totalIncludingFee")),
      reference: requiredString(document["reference"], field("reference")),
      our_reference: optionalString(document["ourReference"]),
      comment:
        comments.length === 0
          ? null
          : requiredString(objectOf(comments[0], field("comments.0"))["msg"], field("comments.0")),
      ...timestamps,
    },
    children: {
      invoice_lines: lines.map((line, position) =>
        mapLine(objectOf(line, field(`customerItemPayments.${position}`)), id, position),
      ),
    },
  };
}

function mapLine(line: Document, invoiceId: string, position: number): Row {
  const field = (name: string) => `invoices.${invoiceId}.customerItemPayments.${position}.${name}`;
  const payment = objectOf(line["payment"], field("payment"));
  const productNumber = optionalString(line["productNumber"]);
  return {
    invoice_id: invoiceId,
    position,
    customer_item_id: hexId(line["customerItem"]),
    item_id: hexId(line["item"]),
    customer_item_type: optionalEnum(
      line["customerItemType"],
      ["rent", "partly-payment"],
      field("customerItemType"),
    ),
    title: requiredString(line["title"], field("title")),
    product_number:
      productNumber === null ? null : integerOf(productNumber, field("productNumber")),
    number_of_items: integerOf(line["numberOfItems"], field("numberOfItems")),
    cancel: line["cancel"] === true,
    unit: amount(payment["unit"], field("payment.unit")),
    gross: amount(payment["gross"], field("payment.gross")),
    net: amount(payment["net"], field("payment.net")),
    vat: amount(payment["vat"], field("payment.vat")),
    discount: amount(payment["discount"], field("payment.discount")),
  };
}

/**
 * The customer number legacy bl-admin exported for a pupil, derived from their user id. The
 * derivation changed on 2023-01-25; invoices made before then keep the old number.
 */
function legacyCustomerNumber(userDetailId: string, createdAt: Date): number {
  const epoch = new Date(Number.parseInt(userDetailId.slice(0, 8), 16)).getTime();
  if (createdAt < DateTime.fromISO("2023-01-25", { zone: "Europe/Oslo" }).toJSDate()) {
    return Math.trunc(Number(String(epoch).slice(2)));
  }
  const increment = Number.parseInt(userDetailId.slice(-6), 16);
  const pair = ((epoch + increment) * (epoch + increment + 1)) / 2 + increment;
  return Number(String(pair).slice(6, 14));
}

/**
 * Dates of birth were stored as text: an ISO instant at midnight of the chosen day in Norwegian
 * time or UTC, or (from the 2026 generator) a `Date.toString()` at UTC midnight; all read as the
 * same calendar day in Norwegian time, which is the day the exports printed. Impossible dates (a
 * typo like year 200206) become NULL.
 */
function calendarDate(value: unknown, field: string): { value: string | null; cleared: boolean } {
  if (value === undefined || value === null || value === "") {
    return { value: null, cleared: false };
  }
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (date === null) {
    throw new TypeError(`${field}: cannot read a date from ${JSON.stringify(value)}`);
  }
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`${field}: cannot read a date from ${JSON.stringify(value)}`);
  }
  const day = DateTime.fromJSDate(date, { zone: "Europe/Oslo" });
  if (day.year < 1900 || day > DateTime.now()) {
    return { value: null, cleared: true };
  }
  return { value: day.toISODate(), cleared: false };
}

function isDocument(value: unknown): value is Document {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function objectOf(value: unknown, field: string): Document {
  if (!isDocument(value)) {
    throw new TypeError(`${field}: expected an object, got ${JSON.stringify(value)}`);
  }
  return value;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${field}: expected a string, got ${JSON.stringify(value)}`);
  }
  return value;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function optionalEnum(value: unknown, values: string[], field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string" || !values.includes(value)) {
    throw new TypeError(`${field}: unexpected value ${JSON.stringify(value)}`);
  }
  return value;
}

function requiredDate(value: unknown, field: string): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  throw new TypeError(`${field}: expected a date, got ${JSON.stringify(value)}`);
}

function integerOf(value: unknown, field: string): number {
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  throw new TypeError(`${field}: expected a whole number, got ${JSON.stringify(value)}`);
}

function amount(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${field}: expected an amount, got ${JSON.stringify(value)}`);
  }
  return value;
}
