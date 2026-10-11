import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Membership is never empty (step 3 of the branch scope plan, 2026-10-12): a customer with no
 * school is a member of the root ("Alle filialer"), so every user belongs to exactly one node and
 * no query needs a null case. The root is the row without a parent, never an id in code.
 *
 * The foreign key used to clear the membership when its branch was deleted; with the column NOT
 * NULL that would fail anyway, so the key now refuses to delete a branch that still has members
 * (there is no branch delete endpoint; this names the rule for whoever adds one).
 */
export default class extends BaseSchema {
  override async up() {
    this.defer(async (db) => {
      const root: { id: string } | null = await db
        .from("branches")
        .whereNull("parent_branch_id")
        .select("id")
        .first();
      // An empty tree (a truncated test database) has no root and no one to move; on real data
      // the root always exists, and a null membership without one fails the NOT NULL below.
      if (root === null) {
        return;
      }
      await db
        .from("users")
        .whereNull("branch_membership_id")
        .update({ branch_membership_id: root.id });
    });
    this.schema.alterTable("users", (table) => {
      table.dropNullable("branch_membership_id");
      table.dropForeign("branch_membership_id");
      table
        .foreign("branch_membership_id")
        .references("id")
        .inTable("branches")
        .onDelete("RESTRICT");
    });
  }

  override async down() {
    this.schema.alterTable("users", (table) => {
      table.setNullable("branch_membership_id");
      table.dropForeign("branch_membership_id");
      table
        .foreign("branch_membership_id")
        .references("id")
        .inTable("branches")
        .onDelete("SET NULL");
    });
    this.defer(async (db) => {
      const root: { id: string } | null = await db
        .from("branches")
        .whereNull("parent_branch_id")
        .select("id")
        .first();
      if (root === null) {
        return;
      }
      await db
        .from("users")
        .where("branch_membership_id", root.id)
        .update({ branch_membership_id: null });
    });
  }
}
