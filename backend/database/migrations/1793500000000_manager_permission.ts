import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Brings back the `manager` level (Filialsjef) between employee and admin, this time with a job:
 * the Filialer workspace. The level was dropped in `1790200000000_drop_manager_permission`
 * because nothing required it. Nobody is promoted here; head office sets managers by hand from
 * the Ansatte tab.
 */
export default class extends BaseSchema {
  protected tableName = "users";

  override async up() {
    this.defer(async (database) => {
      await database.rawQuery(`ALTER TABLE users DROP CONSTRAINT users_permission_check`);
      await database.rawQuery(
        `ALTER TABLE users ADD CONSTRAINT users_permission_check
         CHECK (permission IN ('customer', 'employee', 'manager', 'admin'))`,
      );
    });
  }

  override async down() {
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
}
