import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * The `manager` permission sat between employee and admin without any route, ability or screen
 * requiring it, so it only ever behaved as an employee. The four staging managers (and their
 * production counterparts) become employees, and the check constraint no longer accepts the value.
 */
export default class extends BaseSchema {
  protected tableName = "users";

  override async up() {
    this.defer(async (database) => {
      await database
        .from(this.tableName)
        .where("permission", "manager")
        .update({ permission: "employee" });
      await database.rawQuery(`ALTER TABLE users DROP CONSTRAINT users_permission_check`);
      await database.rawQuery(
        `ALTER TABLE users ADD CONSTRAINT users_permission_check
         CHECK (permission IN ('customer', 'employee', 'admin'))`,
      );
    });
  }

  override async down() {
    this.defer(async (database) => {
      await database.rawQuery(`ALTER TABLE users DROP CONSTRAINT users_permission_check`);
      await database.rawQuery(
        `ALTER TABLE users ADD CONSTRAINT users_permission_check
         CHECK (permission IN ('customer', 'employee', 'manager', 'admin'))`,
      );
    });
  }
}
