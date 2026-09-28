import { BaseSchema } from "@adonisjs/lucid/schema";

/** The subject matching key of `normalizeSubjectName` (whitespace removed, lower case), in SQL. */
const normalized = (column: string) => `lower(regexp_replace(${column}, '[[:space:]]', '', 'g'))`;

/**
 * Branch subjects replace branch items: a branch offers a title by listing it under a subject, with
 * the order and at-branch options on the subject's book row. A title listed under several subjects
 * is offered at the branch with the union of their options.
 *
 * The subjects are rebuilt from the branch items' `categories`, replacing every existing subject
 * (Adrian's call, 2026-09-28; on staging that drops 55 external names, 69 subjects without a
 * matching category and 11 books listed only in a subject). One subject per category and branch,
 * with categories that differ only in case or whitespace merged; every tagged title becomes a book
 * of it with the branch item's options. The 8 branch items without a category are dropped: they
 * were never in the online catalog, and at the branch they fall back to the "not on the list" rules.
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.raw("delete from branch_subjects");
    this.schema.raw(`
      insert into branch_subjects (branch_id, name, external_name, created_at, updated_at)
      select branch_id, min(trim(category)), null, now(), now()
      from branch_items, unnest(categories) as category
      where trim(category) <> ''
      group by branch_id, ${normalized("category")}
    `);
    this.schema.raw(`
      insert into branch_subject_books (
        branch_subject_id, item_id, rent, partly_payment, buy,
        rent_at_branch, partly_payment_at_branch, buy_at_branch, created_at, updated_at
      )
      select distinct on (branch_subjects.id, branch_items.item_id)
        branch_subjects.id, branch_items.item_id, branch_items.rent, branch_items.partly_payment,
        branch_items.buy, branch_items.rent_at_branch, branch_items.partly_payment_at_branch,
        branch_items.buy_at_branch, now(), now()
      from branch_items
      cross join lateral unnest(branch_items.categories) as category
      join branch_subjects
        on branch_subjects.branch_id = branch_items.branch_id
        and ${normalized("branch_subjects.name")} = ${normalized("category")}
    `);
    this.schema.dropTable("branch_items");
  }

  /**
   * Restores one branch item per (branch, title) listed under a subject, with the union of its
   * books' options and the subjects' names as categories. The deleted subjects do not come back.
   */
  override async down() {
    this.schema.createTable("branch_items", (table) => {
      table.string("id", 24).primary();
      table
        .string("branch_id", 24)
        .notNullable()
        .references("id")
        .inTable("branches")
        .onDelete("CASCADE");
      table
        .string("item_id", 24)
        .notNullable()
        .references("id")
        .inTable("items")
        .onDelete("CASCADE");
      table.boolean("rent").notNullable().defaultTo(false);
      table.boolean("partly_payment").notNullable().defaultTo(false);
      table.boolean("buy").notNullable().defaultTo(false);
      table.boolean("rent_at_branch").notNullable().defaultTo(false);
      table.boolean("partly_payment_at_branch").notNullable().defaultTo(false);
      table.boolean("buy_at_branch").notNullable().defaultTo(false);
      table.specificType("categories", "text[]").notNullable().defaultTo("{}");
      table.timestamp("created_at").notNullable();
      table.timestamp("updated_at").notNullable();
      table.unique(["branch_id", "item_id"]);
      table.index(["item_id"]);
    });
    this.schema.raw(`
      insert into branch_items (
        id, branch_id, item_id, rent, partly_payment, buy,
        rent_at_branch, partly_payment_at_branch, buy_at_branch, categories, created_at, updated_at
      )
      select
        substr(md5(branch_subjects.branch_id || branch_subject_books.item_id), 1, 24),
        branch_subjects.branch_id, branch_subject_books.item_id,
        bool_or(branch_subject_books.rent), bool_or(branch_subject_books.partly_payment),
        bool_or(branch_subject_books.buy), bool_or(branch_subject_books.rent_at_branch),
        bool_or(branch_subject_books.partly_payment_at_branch),
        bool_or(branch_subject_books.buy_at_branch),
        array_agg(distinct branch_subjects.name), now(), now()
      from branch_subject_books
      join branch_subjects on branch_subjects.id = branch_subject_books.branch_subject_id
      group by branch_subjects.branch_id, branch_subject_books.item_id
    `);
  }
}
