import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Customers an admin has excluded from a round: the match finder skips them entirely, so they get
 * no matches and their books reach other students through the stand instead. Part of the plan, and
 * so frozen once the round has been generated. Defaults to empty because existing rounds excluded
 * nobody.
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.alterTable("match_rounds", (table) => {
      table.specificType("excluded_customer_ids", "text[]").notNullable().defaultTo("{}");
    });
  }

  override async down() {
    this.schema.alterTable("match_rounds", (table) => {
      table.dropColumn("excluded_customer_ids");
    });
  }
}
