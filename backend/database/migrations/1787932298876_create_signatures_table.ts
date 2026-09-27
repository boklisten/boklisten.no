import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Moves signatures from MongoDB to Postgres and inverts the relationship: the signature row now
 * stores the customer it belongs to, instead of user details keeping an array of signature ids.
 * The newest signature per customer is the only one any consumer reads, but the full history is
 * kept because a signature is a signed legal agreement.
 *
 * The backfill runs here (inside Railway's private network on deploy) rather than from a local
 * machine, so no database ever needs public access. Mongo signature documents carry no customer
 * reference, so the customer is resolved through the `signatures` arrays on user details; signature
 * documents no user detail references cannot be attributed to anyone and are skipped. `created_at`
 * is set to the original Mongo `creationTime`, since signing time and row creation are the same
 * moment for every row written after this migration.
 *
 * After the transfer, the Mongo `signatures` collection is dropped, along with the long-dead
 * `stand_matches` and `user_matches` collections (already migrated to Postgres).
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("signatures", (table) => {
      table.increments("id");
      table.string("customer_details_id", 24).notNullable();
      table.string("signing_name").notNullable();
      table.boolean("signed_by_guardian").notNullable();
      table.binary("image").notNullable();

      table.timestamp("created_at");
      table.timestamp("updated_at");

      table.index(["customer_details_id", "created_at"]);
    });

    // The MongoDB transfer that ran here (2026-08-30) was removed on 2026-09-28.
  }

  override async down() {
    this.schema.dropTable("signatures");
  }
}
