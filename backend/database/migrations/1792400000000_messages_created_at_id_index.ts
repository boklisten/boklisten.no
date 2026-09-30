import { BaseSchema } from "@adonisjs/lucid/schema";

/** The message log feed pages by `(created_at, id)`; the composite index replaces the single one. */
export default class extends BaseSchema {
  override async up() {
    this.schema.alterTable("messages", (table) => {
      table.index(["created_at", "id"]);
      table.dropIndex(["created_at"]);
    });
  }

  override async down() {
    this.schema.alterTable("messages", (table) => {
      table.index(["created_at"]);
      table.dropIndex(["created_at", "id"]);
    });
  }
}
