import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * A round is now planned before it is generated: it carries the dates, times, places and book
 * selection it will be built from, and only later grows matches.
 *
 * Every plan field is required, because a round without one cannot be generated and a half-filled
 * plan is not a plan. Rounds created before this migration kept their plan only in the request body
 * that generated them, so there is nothing to backfill from and inventing dates for them would be
 * worse than dropping them. They are deleted instead: matches, participants and obligations cascade,
 * while recorded handovers survive with their obligation links set to null.
 */
export default class extends BaseSchema {
  override async up() {
    this.defer(async (database) => {
      await database.from("match_rounds").delete();
    });

    this.schema.alterTable("match_rounds", (table) => {
      table.date("deadline").notNullable();
      table.date("meeting_date").notNullable();
      table.string("user_meeting_from", 5).notNullable();
      table.string("user_meeting_to", 5).notNullable();
      table.string("stand_from", 5).notNullable();
      table.string("stand_to", 5).notNullable();
      table.boolean("include_customer_items_from_other_branches").notNullable().defaultTo(false);
      table.specificType("branches", "text[]").notNullable();
      table.specificType("user_match_locations", "text[]").notNullable();
    });
  }

  override async down() {
    this.schema.alterTable("match_rounds", (table) => {
      table.dropColumn("deadline");
      table.dropColumn("meeting_date");
      table.dropColumn("user_meeting_from");
      table.dropColumn("user_meeting_to");
      table.dropColumn("stand_from");
      table.dropColumn("stand_to");
      table.dropColumn("include_customer_items_from_other_branches");
      table.dropColumn("branches");
      table.dropColumn("user_match_locations");
    });
  }
}
