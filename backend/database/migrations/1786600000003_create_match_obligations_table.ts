import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("match_obligations", (table) => {
      table.increments("id");
      table
        .integer("match_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("matches")
        .onDelete("CASCADE");
      table.integer("sender_participant_id").unsigned().notNullable();
      table.integer("receiver_participant_id").unsigned().notNullable();
      table.string("item_id", 24).notNullable();
      table.boolean("locked_to_match").notNullable().defaultTo(true);

      table.timestamp("created_at");
      table.timestamp("updated_at");

      // Composite foreign keys: both parties must belong to THIS match.
      table
        .foreign(["sender_participant_id", "match_id"])
        .references(["id", "match_id"])
        .inTable("match_participants")
        .onDelete("CASCADE");
      table
        .foreign(["receiver_participant_id", "match_id"])
        .references(["id", "match_id"])
        .inTable("match_participants")
        .onDelete("CASCADE");

      table.index(["match_id"]);
      table.index(["item_id"]);
    });

    this.schema.raw(
      `ALTER TABLE match_obligations ADD CONSTRAINT match_obligations_distinct_parties_check
       CHECK (sender_participant_id <> receiver_participant_id)`,
    );
  }

  override async down() {
    this.schema.dropTable("match_obligations");
  }
}
