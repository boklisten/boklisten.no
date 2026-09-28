import { BaseSchema } from "@adonisjs/lucid/schema";

interface ColumnRename {
  table: string;
  from: string;
  to: string;
  /** Constraints named after the column, by suffix (`<table>_<column>_<suffix>`). */
  constraints: ("not_null" | "foreign")[];
  /** Indexes and unique constraints named after the column, as [old, new]. */
  indexes?: [string, string][];
}

/**
 * Column names that break the target conventions become plain ones:
 * - `opening_hours."from"`/`"to"` are reserved words that every raw query had to quote. They
 *   become `opens_at`/`closes_at`.
 * - References to `users` were named after the legacy "UserDetail" document
 *   (`user_detail_id`, `customer_details_id`, `initiated_by_details_id`). They become
 *   `<role>_id`: `user_id` for a plain account owner, `customer_id` for the customer a signature
 *   or message is about.
 *
 * Constraints and indexes are renamed with their columns so their names keep describing them. A
 * rename touches only the catalog, so no table is rewritten.
 */
const RENAMES: ColumnRename[] = [
  {
    table: "opening_hours",
    from: "from",
    to: "opens_at",
    constraints: ["not_null"],
  },
  {
    table: "opening_hours",
    from: "to",
    to: "closes_at",
    constraints: ["not_null"],
    indexes: [["opening_hours_branch_id_to_index", "opening_hours_branch_id_closes_at_index"]],
  },
  {
    table: "email_verifications",
    from: "user_detail_id",
    to: "user_id",
    constraints: ["not_null", "foreign"],
    indexes: [["email_verifications_user_detail_id_index", "email_verifications_user_id_index"]],
  },
  {
    table: "password_resets",
    from: "user_detail_id",
    to: "user_id",
    constraints: ["not_null", "foreign"],
    indexes: [["password_resets_user_detail_id_index", "password_resets_user_id_index"]],
  },
  {
    table: "signatures",
    from: "customer_details_id",
    to: "customer_id",
    constraints: ["not_null", "foreign"],
    indexes: [
      [
        "signatures_customer_details_id_created_at_index",
        "signatures_customer_id_created_at_index",
      ],
    ],
  },
  {
    table: "match_participants",
    from: "user_detail_id",
    to: "user_id",
    constraints: ["foreign"],
    indexes: [
      ["match_participants_user_detail_id_index", "match_participants_user_id_index"],
      [
        "match_participants_match_id_user_detail_id_unique",
        "match_participants_match_id_user_id_unique",
      ],
    ],
  },
  {
    table: "book_handovers",
    from: "from_user_detail_id",
    to: "from_user_id",
    constraints: ["foreign"],
    indexes: [["book_handovers_from_user_detail_id_index", "book_handovers_from_user_id_index"]],
  },
  {
    table: "book_handovers",
    from: "to_user_detail_id",
    to: "to_user_id",
    constraints: ["foreign"],
    indexes: [["book_handovers_to_user_detail_id_index", "book_handovers_to_user_id_index"]],
  },
  {
    table: "messages",
    from: "regarding_customer_details_id",
    to: "customer_id",
    constraints: ["foreign"],
    indexes: [
      [
        "messages_regarding_customer_details_id_created_at_index",
        "messages_customer_id_created_at_index",
      ],
    ],
  },
  {
    table: "sendouts",
    from: "initiated_by_details_id",
    to: "initiated_by_id",
    constraints: ["foreign"],
    indexes: [["sendouts_initiated_by_details_id_index", "sendouts_initiated_by_id_index"]],
  },
];

export default class extends BaseSchema {
  override async up() {
    for (const rename of RENAMES) {
      this.rename(rename, rename.from, rename.to, false);
    }
  }

  override async down() {
    for (const rename of RENAMES.toReversed()) {
      this.rename(rename, rename.to, rename.from, true);
    }
  }

  private rename(
    { table, constraints, indexes = [] }: ColumnRename,
    from: string,
    to: string,
    reverse: boolean,
  ) {
    this.schema.raw(`alter table ${table} rename column "${from}" to "${to}"`);
    for (const suffix of constraints) {
      const rename = `alter table ${table} rename constraint ${table}_${from}_${suffix} to ${table}_${to}_${suffix}`;
      // Only PG 18 names NOT NULL constraints; on an older server there is nothing to rename.
      this.schema.raw(
        suffix === "not_null"
          ? `do $$ begin
               if exists (select 1 from pg_constraint
                          where conrelid = '${table}'::regclass and conname = '${table}_${from}_${suffix}') then
                 ${rename};
               end if;
             end $$`
          : rename,
      );
    }
    for (const [oldName, newName] of indexes) {
      const [source, target] = reverse ? [newName, oldName] : [oldName, newName];
      this.schema.raw(`alter index ${source} rename to ${target}`);
    }
  }
}
