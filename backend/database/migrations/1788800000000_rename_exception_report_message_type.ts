import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * The exception report became the employee monitoring report; existing log rows follow the
 * rename so the message log keeps labelling them.
 */
export default class extends BaseSchema {
  override async up() {
    this.defer(async (db) => {
      await db
        .from("messages")
        .where("message_type", "exception-report")
        .update({ message_type: "employee-monitoring" });
    });
  }

  override async down() {
    this.defer(async (db) => {
      await db
        .from("messages")
        .where("message_type", "employee-monitoring")
        .update({ message_type: "exception-report" });
    });
  }
}
