import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  override async up() {
    this.schema.alterTable("customer_items", (table) => {
      table.index(["created_at", "id"]);
    });
    this.schema.alterTable("opening_hours", (table) => {
      table.index(["branch_id", "to"]);
    });
    this.schema.alterTable("messages", (table) => {
      table.index(["regarding_customer_details_id", "created_at"]);
    });
    this.schema.alterTable("book_handovers", (table) => {
      table.index(["order_id"]);
    });
    this.schema.alterTable("match_obligations", (table) => {
      table.index(["sender_participant_id"]);
      table.index(["receiver_participant_id"]);
    });
  }

  override async down() {
    this.schema.alterTable("customer_items", (table) => {
      table.dropIndex(["created_at", "id"]);
    });
    this.schema.alterTable("opening_hours", (table) => {
      table.dropIndex(["branch_id", "to"]);
    });
    this.schema.alterTable("messages", (table) => {
      table.dropIndex(["regarding_customer_details_id", "created_at"]);
    });
    this.schema.alterTable("book_handovers", (table) => {
      table.dropIndex(["order_id"]);
    });
    this.schema.alterTable("match_obligations", (table) => {
      table.dropIndex(["sender_participant_id"]);
      table.dropIndex(["receiver_participant_id"]);
    });
  }
}
