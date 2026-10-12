import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Every user gets a home node (step 5 of the branch scope plan, 2026-10-12): the branch they work
 * from, which from step 7 on bounds what staff can see and touch. It is named for the one role
 * that ever holds anything but the root; customers, guests and admins sit on the root ("Alle
 * filialer"), so the column is NOT NULL and no query needs a null case. Nothing reads it yet.
 *
 * RESTRICT like the membership key: a branch that is still someone's home node cannot be deleted.
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.alterTable("users", (table) => {
      table
        .string("employee_branch_id", 24)
        .nullable()
        .references("id")
        .inTable("branches")
        .onDelete("RESTRICT");
      table.index(["employee_branch_id"]);
    });
    this.defer(async (db) => {
      const root: { id: string } | null = await db
        .from("branches")
        .whereNull("parent_branch_id")
        .select("id")
        .first();
      // An empty tree (a truncated test database) has no root and no one to home; on real data
      // the root always exists, and a user without one fails the NOT NULL below.
      if (root === null) {
        return;
      }
      await db
        .from("users")
        .whereNull("employee_branch_id")
        .update({ employee_branch_id: root.id });
    });
    this.schema.alterTable("users", (table) => {
      table.dropNullable("employee_branch_id");
    });
  }

  override async down() {
    this.schema.alterTable("users", (table) => {
      table.dropColumn("employee_branch_id");
    });
  }
}
