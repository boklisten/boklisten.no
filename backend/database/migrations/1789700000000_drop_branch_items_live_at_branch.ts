import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * `branchItemsLiveAtBranch` ("Synlig for ansatte") was a toggle on the branch form that nothing
 * read: employees see every branch, and the sibling `branchItemsLiveOnline` alone decides which
 * branches customers may order from (`Branch.publicByName`).
 */
export default class extends BaseSchema {
  protected tableName = "branches";

  override async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn("branch_items_live_at_branch");
    });
  }

  override async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean("branch_items_live_at_branch").notNullable().defaultTo(false);
    });
  }
}
