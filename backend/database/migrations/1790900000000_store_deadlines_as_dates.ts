import { BaseSchema } from "@adonisjs/lucid/schema";

/** The columns that hold a deadline, which is always the end of a calendar day. */
const DEADLINE_COLUMNS = [
  ["customer_items", "deadline"],
  ["customer_item_period_extends", "period_to"],
  ["order_items", "period_to"],
  ["branch_periods", "date"],
] as const;

/** The deadlines used every year: 1 February, 1 July, 1 September and 20 December. */
const STANDARD_MONTH_DAYS = ["02-01", "07-01", "09-01", "12-20"];

const standardList = STANDARD_MONTH_DAYS.map((monthDay) => `'${monthDay}'`).join(", ");

/** `column` moved to the nearest standard deadline, the later one on a tie. */
function nearestStandard(column: string): string {
  return `(
    select candidate from (
      select make_date(year, split_part(month_day, '-', 1)::int, split_part(month_day, '-', 2)::int) as candidate
      from generate_series(extract(year from ${column})::int - 1, extract(year from ${column})::int + 1) as year,
        unnest(array[${standardList}]) as month_day
    ) as candidates
    order by abs(candidate - ${column}), candidate desc
    limit 1
  )`;
}

function isNonStandard(column: string): string {
  return `to_char(${column}, 'MM-DD') not in (${standardList})`;
}

/**
 * Deadlines were stored as instants at local or UTC midnight (00:00, 01:00 or 02:00 in Oslo), so
 * readers padded their comparisons by a day or two. They become plain calendar days, like `dob`,
 * and the Oslo day of the stored instant is the intended one for every row. An invoice's due date
 * is a calendar day too, but it is not a loan deadline and keeps its own day.
 *
 * The few loan deadlines off the standard days (235 returned Ullern rentals due 2025-01-20 and a
 * handful of 2021-2023 test and one-off rows) move to the nearest standard day. An order line
 * carrying a customer item takes that item's (moved) deadline instead, which repairs a 2021-01-07
 * typo on an order placed in May 2022.
 */
export default class extends BaseSchema {
  override async up() {
    for (const [table, column] of [...DEADLINE_COLUMNS, ["invoices", "due_date"] as const]) {
      this.schema.raw(
        `alter table ${table} alter column "${column}" type date using ("${column}" at time zone 'Europe/Oslo')::date`,
      );
    }

    this.schema.raw(
      `update customer_items set deadline = ${nearestStandard("deadline")} where ${isNonStandard("deadline")}`,
    );
    this.schema.raw(
      `update order_items set period_to = customer_items.deadline
       from customer_items
       where customer_items.id = order_items.customer_item_id and ${isNonStandard("order_items.period_to")}`,
    );
    for (const [table, column] of DEADLINE_COLUMNS.filter(([name]) => name !== "customer_items")) {
      this.schema.raw(
        `update ${table} set "${column}" = ${nearestStandard(`"${column}"`)} where ${isNonStandard(`"${column}"`)}`,
      );
    }
  }

  override async down() {
    for (const [table, column] of [...DEADLINE_COLUMNS, ["invoices", "due_date"] as const]) {
      this.schema.raw(
        `alter table ${table} alter column "${column}" type timestamptz using "${column}"::timestamp at time zone 'Europe/Oslo'`,
      );
    }
  }
}
