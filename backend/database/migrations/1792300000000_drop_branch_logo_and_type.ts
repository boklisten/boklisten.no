import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * `logo` was never set on any branch and `type` (vgs/privatist) is replaced by what a branch
 * offers: rent periods (a school) or partly-payment periods (a privatist branch). `down()` only
 * restores the empty columns; the type of a branch can be read from its periods.
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.alterTable("branches", (table) => {
      table.dropColumn("logo");
      table.dropColumn("type");
    });
  }

  override async down() {
    this.schema.alterTable("branches", (table) => {
      table.text("logo").nullable();
      table.enu("type", ["vgs", "privatist"]).nullable();
    });
  }
}
