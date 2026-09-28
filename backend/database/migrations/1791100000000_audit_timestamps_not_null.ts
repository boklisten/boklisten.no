import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Every application table's `created_at` and `updated_at` become `NOT NULL DEFAULT now()`.
 *
 * Lucid fills them in through `autoCreate`/`autoUpdate`, but raw inserts (the match generator, the
 * message log) and anything run by hand did not get a value from the database. No row has a NULL
 * today, so tightening needs no repair. The default also lets raw inserts leave both columns out.
 *
 * The tables moved from MongoDB with their timestamps required are already `NOT NULL`; they only
 * gain the default. `customer_item_period_extends` has no `updated_at`, since its rows are never
 * edited. `remember_me_tokens` belongs to Adonis and is left alone.
 *
 * `SET DEFAULT` changes only the catalog. `SET NOT NULL` scans the table once, and the largest
 * table it touches is `unique_items` (about 52k rows).
 */
const NULLABLE_TABLES = [
  "book_handovers",
  "branch_items",
  "branch_subject_books",
  "branch_subjects",
  "branches",
  "companies",
  "editable_texts",
  "email_verifications",
  "items",
  "match_obligations",
  "match_participants",
  "match_rounds",
  "matches",
  "message_events",
  "messages",
  "opening_hours",
  "password_resets",
  "question_and_answers",
  "sendouts",
  "signatures",
  "unique_items",
  "users",
  "waiting_list_customers",
];

const REQUIRED_TABLES = ["customer_items", "deliveries", "invoices", "orders", "payments"];

export default class extends BaseSchema {
  override async up() {
    for (const table of NULLABLE_TABLES) {
      this.schema.raw(
        `alter table ${table}
           alter column created_at set not null, alter column created_at set default now(),
           alter column updated_at set not null, alter column updated_at set default now()`,
      );
    }
    for (const table of REQUIRED_TABLES) {
      this.schema.raw(
        `alter table ${table}
           alter column created_at set default now(),
           alter column updated_at set default now()`,
      );
    }
    this.schema.raw(
      `alter table customer_item_period_extends alter column created_at set default now()`,
    );
  }

  override async down() {
    for (const table of NULLABLE_TABLES) {
      this.schema.raw(
        `alter table ${table}
           alter column created_at drop not null, alter column created_at drop default,
           alter column updated_at drop not null, alter column updated_at drop default`,
      );
    }
    for (const table of REQUIRED_TABLES) {
      this.schema.raw(
        `alter table ${table}
           alter column created_at drop default,
           alter column updated_at drop default`,
      );
    }
    this.schema.raw(
      `alter table customer_item_period_extends alter column created_at drop default`,
    );
  }
}
