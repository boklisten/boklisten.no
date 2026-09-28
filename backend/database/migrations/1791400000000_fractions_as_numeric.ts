import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Fractions and item weights were stored as `double precision`, so a value like 0.33 was only ever
 * an approximation and nothing kept a percentage between 0 and 1. They become `numeric` with a
 * range `CHECK`. The pg type parser in `config/database.ts` already reads NUMERIC as a number, so
 * the API is unchanged.
 *
 * Fractions keep whole percents (`numeric(3,2)`), the precision the admin sliders and the
 * whole-percent discount field work in. The conversion rounds every stored value to that, which
 * changes some legacy data (staging, 2026-09-28):
 * - 1/3 stored as `0.333` (or `0.333333`) becomes `0.33`. This affects `sell_percentage` on 56
 *   branches and `percentage_buyout` on 10 partly-payment periods, so some buyback and buyout
 *   prices drop by 10 kr.
 * - The `0.175` discount on two items becomes `0.18`.
 * - The `0.001` rent on the inactive test branch Flåklypa VGS becomes `0`.
 *
 * Weights are kilograms to the gram (`numeric(6,3)`); an unknown weight stays NULL, never 0.
 * Extra decimals written later are rounded by Postgres, not rejected. `down()` restores the float
 * type but not the unrounded values.
 */
/** `hasDefault`: the column defaults to 1, re-set so the default loses its float cast. */
const FRACTIONS: { table: string; column: string; hasDefault?: boolean }[] = [
  { table: "branches", column: "buyout_percentage", hasDefault: true },
  { table: "branches", column: "sell_percentage", hasDefault: true },
  { table: "branch_periods", column: "percentage" },
  { table: "branch_periods", column: "percentage_buyout" },
  { table: "branch_periods", column: "percentage_up_front" },
  { table: "items", column: "discount" },
];

export default class extends BaseSchema {
  override async up() {
    for (const { table, column, hasDefault } of FRACTIONS) {
      this.schema.raw(
        `alter table ${table}
           alter column ${column} type numeric(3,2) using round(${column}::numeric, 2),
           ${hasDefault ? `alter column ${column} set default 1,` : ""}
           add constraint ${table}_${column}_check check (${column} between 0 and 1)`,
      );
    }
    this.schema.raw(
      `alter table items
         alter column weight type numeric(6,3) using round(weight::numeric, 3),
         add constraint items_weight_check check (weight > 0)`,
    );
  }

  override async down() {
    for (const { table, column, hasDefault } of FRACTIONS) {
      this.schema.raw(
        `alter table ${table}
           drop constraint ${table}_${column}_check,
           alter column ${column} type double precision
           ${hasDefault ? `, alter column ${column} set default 1` : ""}`,
      );
    }
    this.schema.raw(
      `alter table items
         drop constraint items_weight_check,
         alter column weight type double precision`,
    );
  }
}
