import { BaseSchema } from "@adonisjs/lucid/schema";

/** SMS login is always on: a switch to turn it off told anyone with the number that the account exists. */
export default class extends BaseSchema {
  override async up() {
    this.schema.alterTable("users", (table) => {
      table.dropColumn("sms_login_enabled");
    });
  }

  override async down() {
    this.schema.alterTable("users", (table) => {
      table.boolean("sms_login_enabled").notNullable().defaultTo(true);
    });
  }
}
