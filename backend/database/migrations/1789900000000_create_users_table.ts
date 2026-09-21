import { BaseSchema } from "@adonisjs/lucid/schema";
import type { QueryClientContract } from "@adonisjs/lucid/types/database";
import { DateTime } from "luxon";
import type { Document } from "mongodb";

import {
  assertRowCount,
  dropCollection,
  hexId,
  requiredHexId,
  timestampOf,
  transferCollection,
  withMongo,
} from "#database/helpers/mongo_transfer";
import type { Db, MapResult, Row } from "#database/helpers/mongo_transfer";
import env from "#start/env";

/**
 * Step 5 of `docs/postgres-migration-plan.md`: the `userdetails` (the customer's contact details,
 * tasks and branch membership) and `users` (permission and login credentials) collections, which
 * were 1:1, merge into one Postgres table `users` keyed by the user-details id, since that is the
 * id every access token, route, avatar seed and existing Postgres column already carries. The old
 * `users._id` disappears; nothing stored it.
 *
 * Schema fixes made on the way, backed by the staging survey recorded in the plan: the `guardian`
 * and `tasks` subdocuments and the `login` tree are flattened into columns; the `orders` and
 * `customerItems` arrays are dropped (the orders and customer items carry the customer reference
 * themselves, and the arrays had drifted: more than 100 000 entries pointed at documents of
 * deleted users); `dob` becomes a calendar date; phones are normalised to eight digits; the meta
 * fields `user`, `editableFor`, `viewableFor`, `active` (never false), the legacy `signatures`
 * array, `lastActive` and `temporaryGroupMembership` (nothing reads them) are dropped.
 *
 * The eight Postgres columns that already held user-details ids become real foreign keys, after
 * their orphans (rows left behind by earlier user deletions) are cleaned up as the plan decided.
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("users", (table) => {
      table.string("id", 24).primary();
      // Contact details. Empty string means "not filled in yet" (the customer is then asked to
      // confirm their details on next login); phone is NULL instead so it can stay unique.
      table.text("name").notNullable().defaultTo("");
      table.text("email").notNullable();
      table.text("phone").nullable();
      table.text("address").notNullable().defaultTo("");
      table.text("post_code").notNullable().defaultTo("");
      table.text("post_city").notNullable().defaultTo("");
      table.boolean("email_confirmed").notNullable().defaultTo(false);
      // Date of birth as a calendar date; decides whether a guardian must sign the loan agreement.
      table.date("dob").nullable();
      // The guardian of an underage customer.
      table.text("guardian_name").nullable();
      table.text("guardian_email").nullable();
      table.text("guardian_phone").nullable();
      // The random identifier carried as `sub` in access and refresh tokens.
      table.text("blid").notNullable().unique();
      // SET NULL: a customer outlives the class or school they were a member of.
      table
        .string("branch_membership_id", 24)
        .nullable()
        .references("id")
        .inTable("branches")
        .onDelete("SET NULL");
      // Pending tasks the customer must complete before using the site.
      table.boolean("task_confirm_details").notNullable().defaultTo(false);
      table.boolean("task_sign_agreement").notNullable().defaultTo(false);
      table
        .enu("permission", ["customer", "employee", "manager", "admin"])
        .notNullable()
        .defaultTo("customer");
      // Login credentials. A user may have a password, a Vipps identity, both or (provisioned by
      // a school, or created before the current auth flow) neither.
      table.text("local_hashed_password").nullable();
      table.timestamp("local_last_login").nullable();
      table.text("vipps_user_id").nullable();
      table.timestamp("vipps_last_login").nullable();
      table.timestamp("last_token_issued_at").nullable();

      table.timestamp("created_at");
      table.timestamp("updated_at");

      table.index(["branch_membership_id"]);
      table.index(["permission"]);
    });
    // Emails are compared case-insensitively everywhere; the app lowercases on write, the index
    // guards against the two legacy documents that were not.
    this.schema.raw('CREATE UNIQUE INDEX "users_email_unique" ON "users" (lower("email"))');
    this.schema.raw(
      'CREATE UNIQUE INDEX "users_phone_unique" ON "users" ("phone") WHERE "phone" IS NOT NULL',
    );
    this.schema.raw(
      'CREATE UNIQUE INDEX "users_vipps_user_id_unique" ON "users" ("vipps_user_id") WHERE "vipps_user_id" IS NOT NULL',
    );

    // Both token tables were created with string(255) before the id format was settled.
    for (const tokenTable of ["email_verifications", "password_resets"]) {
      this.schema.alterTable(tokenTable, (table) => {
        table.string("user_detail_id", 24).notNullable().alter();
      });
    }

    this.defer(async (database) => {
      if (env.get("API_ENV") === "test") {
        return;
      }
      await withMongo(async (mongo) => {
        const logins = await loadLogins(mongo);
        const stats = { phonesLeftAsIs: 0, guardianPhonesLeftAsIs: 0, dobsCleared: 0 };
        const result = await transferCollection({
          mongo,
          database,
          collection: "userdetails",
          table: "users",
          map: (document) => mapUser(document, logins, stats),
        });
        await assertRowCount(database, "users", result.migrated);
        console.log(
          `users: ${logins.withoutDetails} login documents without user details skipped, ` +
            `${logins.duplicateVippsCleared} duplicate Vipps identities cleared, ` +
            `${stats.phonesLeftAsIs} phones and ${stats.guardianPhonesLeftAsIs} guardian phones left as they were, ` +
            `${stats.dobsCleared} impossible dates of birth cleared`,
        );

        await cleanUpOrphans(database);

        // The dropped arrays were the only way to find a customer's orders and customer items; the
        // child-side lookups need these indexes until steps 8 and 9 move the collections.
        for (const collection of ["orders", "customeritems"]) {
          const name = await mongo
            .collection(collection)
            .createIndex({ customer: 1 }, { name: "customer_1" });
          console.log(`${collection} index ensured: ${name}`);
        }

        await dropCollection(mongo, "userdetails");
        await dropCollection(mongo, "users");
      });
    });

    // Keys on the existing columns are added after the transfer and the orphan clean-up above
    // (schema and defer calls run in registration order).
    // CASCADE: a deleted customer's signatures, login tokens and match participations go too;
    // deleting a participant cascades to their obligations, whose handovers keep history with
    // their discharge pointers set to null.
    for (const [referencingTable, column] of [
      ["signatures", "customer_details_id"],
      ["match_participants", "user_detail_id"],
      ["email_verifications", "user_detail_id"],
      ["password_resets", "user_detail_id"],
    ] as const) {
      this.schema.alterTable(referencingTable, (table) => {
        table.foreign(column).references("id").inTable("users").onDelete("CASCADE");
      });
    }
    // SET NULL: handovers, sendouts and messages are history that outlives the people involved.
    for (const [referencingTable, column] of [
      ["book_handovers", "from_user_detail_id"],
      ["book_handovers", "to_user_detail_id"],
      ["sendouts", "initiated_by_details_id"],
      ["messages", "regarding_customer_details_id"],
    ] as const) {
      this.schema.alterTable(referencingTable, (table) => {
        table.foreign(column).references("id").inTable("users").onDelete("SET NULL");
      });
    }
  }

  override async down() {
    for (const [referencingTable, column] of [
      ["signatures", "customer_details_id"],
      ["match_participants", "user_detail_id"],
      ["email_verifications", "user_detail_id"],
      ["password_resets", "user_detail_id"],
      ["book_handovers", "from_user_detail_id"],
      ["book_handovers", "to_user_detail_id"],
      ["sendouts", "initiated_by_details_id"],
      ["messages", "regarding_customer_details_id"],
    ] as const) {
      this.schema.alterTable(referencingTable, (table) => {
        table.dropForeign([column]);
      });
    }
    this.schema.dropTable("users");
  }
}

interface Login {
  permission: string;
  localHashedPassword: string | null;
  localLastLogin: Date | null;
  vippsUserId: string | null;
  vippsLastLogin: Date | null;
  lastTokenIssuedAt: Date | null;
  updatedAt: Date;
}

interface Logins {
  byDetailsId: Map<string, Login>;
  withoutDetails: number;
  duplicateVippsCleared: number;
}

/**
 * The `users` collection keyed by the user-details id it points at. One Vipps identity was
 * attached to two accounts on staging (a guardian who had logged in on their child's account
 * before creating their own); the column is unique, so only the oldest account keeps it and the
 * others log in again by phone or email, which is how Vipps login resolves the account anyway.
 */
async function loadLogins(mongo: Db): Promise<Logins> {
  const logins: Logins = { byDetailsId: new Map(), withoutDetails: 0, duplicateVippsCleared: 0 };
  const seenVippsUserIds = new Map<string, Login>();
  const documents = await mongo.collection("users").find({}).sort({ creationTime: 1 }).toArray();
  for (const document of documents) {
    const detailsId = hexId(document["userDetail"]);
    if (detailsId === null) {
      logins.withoutDetails++;
      continue;
    }
    const login = recordOf(document["login"]);
    const local = recordOf(login["local"]);
    const vipps = recordOf(login["vipps"]);
    const row: Login = {
      permission: permissionOf(document["permission"], `users.${detailsId}.permission`),
      localHashedPassword: optionalString(local["hashedPassword"]),
      localLastLogin: optionalDate(local["lastLogin"]),
      vippsUserId: optionalString(vipps["userId"]),
      vippsLastLogin: optionalDate(vipps["lastLogin"]),
      lastTokenIssuedAt: optionalDate(login["lastTokenIssuedAt"]),
      updatedAt: timestampOf(document, "lastUpdated"),
    };
    if (row.vippsUserId !== null) {
      if (seenVippsUserIds.has(row.vippsUserId)) {
        row.vippsUserId = null;
        row.vippsLastLogin = null;
        logins.duplicateVippsCleared++;
      } else {
        seenVippsUserIds.set(row.vippsUserId, row);
      }
    }
    logins.byDetailsId.set(detailsId, row);
  }
  return logins;
}

function mapUser(
  document: Document,
  logins: Logins,
  stats: { phonesLeftAsIs: number; guardianPhonesLeftAsIs: number; dobsCleared: number },
): MapResult {
  const id = requiredHexId(document["_id"], "userdetails._id");
  const login = logins.byDetailsId.get(id);
  const guardian = recordOf(document["guardian"]);
  const tasks = recordOf(document["tasks"]);
  const phone = normalizePhone(document["phone"]);
  const guardianPhone = normalizePhone(guardian["phone"]);
  if (phone.leftAsIs) {
    stats.phonesLeftAsIs++;
  }
  if (guardianPhone.leftAsIs) {
    stats.guardianPhonesLeftAsIs++;
  }
  const dob = calendarDate(document["dob"], `userdetails.${id}.dob`);
  if (dob.cleared) {
    stats.dobsCleared++;
  }
  const createdAt = timestampOf(document, "creationTime");
  const detailsUpdatedAt = timestampOf(document, "lastUpdated");
  const row: Row = {
    id,
    name: optionalString(document["name"]) ?? "",
    email: requiredString(document["email"], `userdetails.${id}.email`).toLowerCase(),
    phone: phone.value,
    address: optionalString(document["address"]) ?? "",
    post_code: optionalString(document["postCode"]) ?? "",
    post_city: optionalString(document["postCity"]) ?? "",
    email_confirmed: document["emailConfirmed"] === true,
    dob: dob.value,
    guardian_name: optionalString(guardian["name"]),
    guardian_email: optionalString(guardian["email"])?.toLowerCase() ?? null,
    guardian_phone: guardianPhone.value,
    blid: requiredString(document["blid"], `userdetails.${id}.blid`),
    branch_membership_id: hexId(document["branchMembership"]),
    task_confirm_details: tasks["confirmDetails"] === true,
    task_sign_agreement: tasks["signAgreement"] === true,
    permission: login?.permission ?? "customer",
    local_hashed_password: login?.localHashedPassword ?? null,
    local_last_login: login?.localLastLogin ?? null,
    vipps_user_id: login?.vippsUserId ?? null,
    vipps_last_login: login?.vippsLastLogin ?? null,
    last_token_issued_at: login?.lastTokenIssuedAt ?? null,
    created_at: createdAt,
    updated_at: login && login.updatedAt > detailsUpdatedAt ? login.updatedAt : detailsUpdatedAt,
  };
  return { row };
}

/**
 * Rows in the existing tables that point at users deleted before the keys existed. Decided per
 * column in the plan: signatures and login tokens of a deleted user are deleted; a match with a
 * deleted participant is deleted whole (its participants and obligations cascade, handovers keep
 * history with null discharge pointers); handovers, sendouts and messages keep their rows with
 * the reference set to null.
 */
async function cleanUpOrphans(database: QueryClientContract) {
  const counts: string[] = [];
  for (const [table, column] of [
    ["signatures", "customer_details_id"],
    ["email_verifications", "user_detail_id"],
    ["password_resets", "user_detail_id"],
  ] as const) {
    const deleted = await database.rawQuery(`DELETE FROM ${table} WHERE ${orphans(column)}`);
    counts.push(`${rowCount(deleted)} ${table} deleted`);
  }
  const matches = await database.rawQuery(
    `DELETE FROM matches WHERE id IN (SELECT match_id FROM match_participants WHERE ${orphans("user_detail_id")})`,
  );
  counts.push(`${rowCount(matches)} matches deleted`);
  for (const [table, column] of [
    ["book_handovers", "from_user_detail_id"],
    ["book_handovers", "to_user_detail_id"],
    ["sendouts", "initiated_by_details_id"],
    ["messages", "regarding_customer_details_id"],
  ] as const) {
    const nullified = await database.rawQuery(
      `UPDATE ${table} SET ${column} = NULL WHERE ${orphans(column)}`,
    );
    counts.push(`${rowCount(nullified)} ${table}.${column} set to null`);
  }
  console.log(`users: orphan references: ${counts.join(", ")}`);
}

/** WHERE clause matching rows whose reference points at no user. */
function orphans(column: string): string {
  return `${column} IS NOT NULL AND ${column} NOT IN (SELECT id FROM users)`;
}

function rowCount(result: unknown): number {
  return typeof result === "object" && result !== null && "rowCount" in result
    ? Number(result.rowCount)
    : 0;
}

function recordOf(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- narrowed to a non-array object
      (value as Record<string, unknown>)
    : {};
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${field}: expected a non-empty string, got ${JSON.stringify(value)}`);
  }
  return value.trim();
}

/** Missing, null and empty strings all mean "not set"; a few legacy numbers are stringified. */
function optionalString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const text = typeof value === "number" ? String(value) : value;
  if (typeof text !== "string") {
    throw new TypeError(`expected a string, got ${JSON.stringify(value)}`);
  }
  const trimmed = text.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function optionalDate(value: unknown): Date | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  throw new TypeError(`expected a date, got ${JSON.stringify(value)}`);
}

/**
 * Norwegian mobile numbers are stored as eight digits. Legacy documents hold a few with a `+47`
 * or `0047` prefix, surrounding spaces, or as numbers; anything that does not come out as eight
 * digits is kept as it was and counted.
 */
function normalizePhone(value: unknown): { value: string | null; leftAsIs: boolean } {
  const text = optionalString(value);
  if (text === null) {
    return { value: null, leftAsIs: false };
  }
  const digits = text.replaceAll(/\s/g, "").replace(/^(?<countryCode>\+47|0047)/, "");
  if (/^\d{8}$/.test(digits)) {
    return { value: digits, leftAsIs: false };
  }
  return { value: text, leftAsIs: true };
}

/**
 * Dates of birth were written as midnight of the chosen day, sometimes in Norwegian time and
 * sometimes in UTC; both read as the same calendar day in Norwegian time. A handful of legacy
 * documents hold impossible dates (a typo like year 200207, or a date in the future); those
 * become "not given", which asks the customer for their date of birth on next login.
 */
function calendarDate(value: unknown, field: string): { value: string | null; cleared: boolean } {
  const date = optionalDate(value);
  if (date === null) {
    return { value: null, cleared: false };
  }
  const day = DateTime.fromJSDate(date, { zone: "Europe/Oslo" });
  if (day.year < 1900 || day > DateTime.now()) {
    return { value: null, cleared: true };
  }
  const iso = day.toISODate();
  if (iso === null) {
    throw new TypeError(`${field}: cannot read a date from ${JSON.stringify(value)}`);
  }
  return { value: iso, cleared: false };
}

function permissionOf(value: unknown, field: string): string {
  if (value === "customer" || value === "employee" || value === "manager" || value === "admin") {
    return value;
  }
  throw new TypeError(`${field}: unexpected permission ${JSON.stringify(value)}`);
}
