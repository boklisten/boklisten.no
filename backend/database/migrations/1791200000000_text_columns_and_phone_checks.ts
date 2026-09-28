import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * `varchar(255)` becomes `text`, and phone numbers are checked by format instead of by length.
 *
 * The 255 was knex's default for `table.string()`, not a rule of the domain. `varchar` → `text` is
 * binary coercible, so Postgres changes only the catalog and rewrites nothing.
 *
 * `waiting_list_customers` (0 rows) is brought in line with the rest: `item_id` gets the
 * `varchar(24)` of every other reference to `items(id)`, and `phone_number varchar(8)` becomes
 * `phone text`, the name and type `users.phone` has.
 *
 * Every stored phone number is the eight digits `phoneField` normalises to, so `users.phone`,
 * `users.guardian_phone` and `waiting_list_customers.phone` get `CHECK (… ~ '^[0-9]{8}$')`.
 * The legacy rows that break it are cleared: one customer phone of seven digits, and seven
 * guardian phones with a stray `+` or the wrong length. Their owners get the confirm-details task
 * (for a guardian phone, only while the customer is under 18, as `invalidUserFields` decides), so
 * the site asks for the number again. `down()` keeps the cleared values cleared.
 *
 * Nothing calls the `uuid-ossp` extension: the code makes uuids with `crypto.randomUUID()`, and
 * Postgres 18 has `gen_random_uuid()` built in. It is dropped.
 */
const TEXT_COLUMNS: Record<string, string[]> = {
  branch_subjects: ["name", "external_name"],
  editable_texts: ["id"],
  match_rounds: ["status", "name", "stand_location"],
  matches: ["meeting_location"],
  message_events: ["source", "event", "error_code", "provider_event_id"],
  messages: [
    "message_type",
    "channel",
    "recipient",
    "subject",
    "template_id",
    "provider_message_id",
    "status",
    "status_detail",
  ],
  sendouts: ["kind", "name"],
  signatures: ["signing_name"],
  waiting_list_customers: ["name"],
};

const PHONE = "'^[0-9]{8}$'";

export default class extends BaseSchema {
  override async up() {
    for (const [table, columns] of Object.entries(TEXT_COLUMNS)) {
      this.schema.raw(
        `alter table ${table} ${columns.map((column) => `alter column ${column} type text`).join(", ")}`,
      );
    }

    this.schema.raw(
      `alter table waiting_list_customers
         alter column item_id type varchar(24),
         alter column phone_number type text`,
    );
    this.schema.raw(`alter table waiting_list_customers rename column phone_number to phone`);

    this.schema.raw(
      `update users set phone = null, task_confirm_details = true, updated_at = now()
       where phone !~ ${PHONE}`,
    );
    this.schema.raw(
      `update users
       set guardian_phone = null,
           task_confirm_details = task_confirm_details or dob > current_date - interval '18 years',
           updated_at = now()
       where guardian_phone !~ ${PHONE}`,
    );

    this.schema.raw(
      `alter table users
         add constraint users_phone_check check (phone ~ ${PHONE}),
         add constraint users_guardian_phone_check check (guardian_phone ~ ${PHONE})`,
    );
    this.schema.raw(
      `alter table waiting_list_customers
         add constraint waiting_list_customers_phone_check check (phone ~ ${PHONE})`,
    );

    this.schema.raw(`drop extension if exists "uuid-ossp"`);
  }

  override async down() {
    this.schema.raw(`create extension if not exists "uuid-ossp"`);

    this.schema.raw(
      `alter table waiting_list_customers drop constraint waiting_list_customers_phone_check`,
    );
    this.schema.raw(
      `alter table users
         drop constraint users_phone_check,
         drop constraint users_guardian_phone_check`,
    );

    this.schema.raw(`alter table waiting_list_customers rename column phone to phone_number`);
    this.schema.raw(
      `alter table waiting_list_customers
         alter column item_id type varchar(255),
         alter column phone_number type varchar(8)`,
    );

    for (const [table, columns] of Object.entries(TEXT_COLUMNS)) {
      this.schema.raw(
        `alter table ${table} ${columns.map((column) => `alter column ${column} type varchar(255)`).join(", ")}`,
      );
    }
  }
}
