import { BaseSchema } from "@adonisjs/lucid/schema";

/** The order flow walks the branch tree instead of grouping branches by region; nothing reads it. */
export default class extends BaseSchema {
  override async up() {
    this.schema.alterTable("branches", (table) => {
      table.dropColumn("region");
    });
  }

  override async down() {
    this.schema.alterTable("branches", (table) => {
      table.text("region").notNullable().defaultTo("");
    });
  }
}
