import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Step 5 of the MongoDB → Postgres migration: the `userdetails` (the customer's contact details,
 * tasks and branch membership) and `users` (permission and login credentials) collections, which
 * were 1:1, merge into one Postgres table `users` keyed by the user-details id, since that is the
 * id every access token, route, avatar seed and existing Postgres column already carries. The old
 * `users._id` disappears; nothing stored it.
 *
 * Schema fixes made on the way, backed by a staging survey: the `guardian`
 * and `tasks` subdocuments and the `login` tree are flattened into columns; the `orders` and
 * `customerItems` arrays are dropped (the orders and customer items carry the customer reference
 * themselves, and the arrays had drifted: more than 100 000 entries pointed at documents of
 * deleted users); `dob` becomes a calendar date; phones are normalised to eight digits; the meta
 * fields `user`, `editableFor`, `viewableFor`, `active` (never false), the legacy `signatures`
 * array, `lastActive` and `temporaryGroupMembership` (nothing reads them) are dropped.
 *
 * The eight Postgres columns that already held user-details ids become real foreign keys, after
 * their orphans (rows left behind by earlier user deletions) are cleaned up as decided after the staging survey.
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

    // The MongoDB transfer that ran here (2026-09-21) was removed on 2026-09-28.

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
