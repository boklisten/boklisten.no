import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * A partly-payment period carried a second pair of fractions "for used books"
 * (`percentageBuyoutUsed`, `percentageUpFrontUsed`). Nothing has ever read them: every price
 * calculation (cart, stand cart, order items, buyout, invoices) uses `percentageBuyout` and
 * `percentageUpFront`, and on every period in the data (staging, 2026-09-18, 65 rows) the "used"
 * value equalled the regular one. The form asked employees to fill in both for no effect.
 */
export default class extends BaseSchema {
  protected tableName = "branch_periods";

  override async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn("percentage_buyout_used");
      table.dropColumn("percentage_up_front_used");
    });
  }

  override async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.double("percentage_buyout_used").nullable();
      table.double("percentage_up_front_used").nullable();
    });
    // The two columns never held anything but a copy of their counterpart.
    this.defer(async (database) => {
      await database.from(this.tableName).update({
        percentage_buyout_used: database.raw("percentage_buyout"),
        percentage_up_front_used: database.raw("percentage_up_front"),
      });
    });
  }
}
