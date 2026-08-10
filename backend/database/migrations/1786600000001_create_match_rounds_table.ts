import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("match_rounds", (table) => {
      table.increments("id");
      table.string("name").notNullable();
      table.string("stand_location").notNullable();
      table.string("status").notNullable().defaultTo("draft");
      table.timestamp("generated_at", { useTz: true }).nullable();

      table.timestamp("created_at");
      table.timestamp("updated_at");
    });

    this.schema.raw(
      `ALTER TABLE match_rounds ADD CONSTRAINT match_rounds_status_check
       CHECK (status IN ('draft', 'active'))`,
    );
  }

  override async down() {
    this.schema.dropTable("match_rounds");
  }
}
