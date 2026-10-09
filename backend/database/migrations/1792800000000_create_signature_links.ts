import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Emailed signing links carry a random token instead of the customer's id, which is no secret:
 * ids are predictable ObjectIds and customers see each other's. One live link per customer, found
 * by the token's hash; the token is also kept encrypted so a still-fresh link can be sent again
 * or copied instead of replaced (see `SignatureLinkService`).
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("signature_links", (table) => {
      table.increments("id");
      table
        .string("user_id", 24)
        .notNullable()
        .unique()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE");
      table.text("token_hash").notNullable().unique();
      table.text("token_encrypted").notNullable();
      table.timestamp("expires_at").notNullable();
      table.timestamp("created_at").notNullable().defaultTo(this.now());
    });
  }

  override async down() {
    this.schema.dropTable("signature_links");
  }
}
