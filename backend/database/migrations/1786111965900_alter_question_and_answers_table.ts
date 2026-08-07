import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  protected tableName = "question_and_answers";

  override async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer("position").notNullable().defaultTo(0);
    });

    // Keep the existing (creation) order for rows that predate the column
    this.defer(async (db) => {
      await db.rawQuery(`update ${this.tableName} set position = id`);
    });
  }

  override async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn("position");
    });
  }
}
