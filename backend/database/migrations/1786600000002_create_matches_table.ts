import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("matches", (table) => {
      table.increments("id");
      table
        .integer("round_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("match_rounds")
        .onDelete("CASCADE");
      table.string("meeting_location").notNullable();
      table.timestamp("meeting_time", { useTz: true }).nullable();

      table.timestamp("created_at");
      table.timestamp("updated_at");

      table.index(["round_id"]);
    });

    this.schema.createTable("match_participants", (table) => {
      table.increments("id");
      table
        .integer("match_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("matches")
        .onDelete("CASCADE");
      // NULL means the stand, which is why this column is nullable.
      table.string("user_detail_id", 24).nullable();
      table.timestamp("created_at");
      table.timestamp("updated_at");
      table.unique(["match_id", "user_detail_id"]);
      // Redundant on its own, but required as the target of the composite
      // foreign keys declared on match_obligations.
      table.unique(["id", "match_id"]);
      table.index(["user_detail_id"]);
    });

    // At most one stand participant per match.
    this.schema.raw(
      `CREATE UNIQUE INDEX match_participants_single_stand
       ON match_participants (match_id)
       WHERE user_detail_id IS NULL`,
    );
  }

  override async down() {
    this.schema.dropTable("match_participants");
    this.schema.dropTable("matches");
  }
}
