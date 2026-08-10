import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("book_handovers", (table) => {
      table.increments("id");
      // The spine of the chain of custody. NULL only for legacy copies that never got a blid:
      // their movements still discharge obligations, but cannot be chained copy-by-copy.
      table.string("blid", 12).nullable();
      table.string("item_id", 24).notNullable();
      // NULL on either side means the stand.
      table.string("from_user_detail_id", 24).nullable();
      table.string("to_user_detail_id", 24).nullable();
      table.timestamp("occurred_at", { useTz: true }).notNullable();
      table
        .integer("discharges_sender_obligation_id")
        .unsigned()
        .nullable()
        .references("id")
        .inTable("match_obligations")
        .onDelete("SET NULL");
      table
        .integer("discharges_receiver_obligation_id")
        .unsigned()
        .nullable()
        .references("id")
        .inTable("match_obligations")
        .onDelete("SET NULL");
      table.string("order_id", 24).nullable();

      table.timestamp("created_at");
      table.timestamp("updated_at");

      table.index(["blid", "occurred_at"]);
      table.index(["from_user_detail_id"]);
      table.index(["to_user_detail_id"]);
      table.index(["item_id"]);
    });

    // An obligation half may be discharged exactly once, even under concurrency.
    this.schema.raw(
      `CREATE UNIQUE INDEX book_handovers_sender_obligation_unique
       ON book_handovers (discharges_sender_obligation_id)
       WHERE discharges_sender_obligation_id IS NOT NULL`,
    );
    this.schema.raw(
      `CREATE UNIQUE INDEX book_handovers_receiver_obligation_unique
       ON book_handovers (discharges_receiver_obligation_id)
       WHERE discharges_receiver_obligation_id IS NOT NULL`,
    );
  }

  override async down() {
    this.schema.dropTable("book_handovers");
  }
}
