import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * The lock concept is gone: a book bound to a student handover no longer hard-blocks stand
 * handout or collection — the employee confirms a warning instead, keyed on the obligation
 * itself. The flag therefore no longer drives any behavior.
 */
export default class extends BaseSchema {
  protected tableName = "match_obligations";

  override async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn("locked_to_match");
    });
  }

  override async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean("locked_to_match").notNullable().defaultTo(true);
    });
  }
}
