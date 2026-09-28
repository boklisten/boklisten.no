import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * The message-log columns whose values are settled get a `CHECK`, as every other enum-like column
 * already has: `messages.channel`, `message_events.source` and `sendouts.kind`. The lists are the
 * unions in `shared/message-log.ts`, frozen here the way a migration freezes a schema.
 *
 * Some columns stay unchecked on purpose. `messages.message_type` and `messages.status` are
 * expected to gain values, and each new value should not need a migration.
 * `message_events.event` and `orders.checkout_state` hold names that SendGrid, Twilio and Vipps
 * own. If a provider adds a name later, the row must still be stored; a failed insert would lose
 * the event.
 *
 * Two values are respelt to the lowercase kebab-case the other enum values use:
 * `branch_periods.kind` `partly_payment` → `partly-payment` (internal only), and `branches.type`
 * `VGS` → `vgs` (an API value; the frontend shows the label "VGS").
 *
 * `match_rounds_status_check` is recreated unchanged: the `varchar` → `text` change in
 * `1791200000000_text_columns_and_phone_checks` left `::character varying` casts in its definition.
 */
const CHECKS: { table: string; column: string; values: string[] }[] = [
  { table: "messages", column: "channel", values: ["sms", "email"] },
  { table: "message_events", column: "source", values: ["internal", "twilio", "sendgrid"] },
  { table: "sendouts", column: "kind", values: ["reminder", "custom", "match-notify"] },
];

/** Values respelt in place; `others` are the column's remaining allowed values. */
const RESPELLINGS = [
  {
    table: "branch_periods",
    column: "kind",
    from: "partly_payment",
    to: "partly-payment",
    others: ["rent", "extend"],
  },
  { table: "branches", column: "type", from: "VGS", to: "vgs", others: ["privatist"] },
];

function check(table: string, column: string, values: string[]): string {
  const list = values.map((value) => `'${value}'`).join(", ");
  return `constraint ${table}_${column}_check check (${column} in (${list}))`;
}

export default class extends BaseSchema {
  /** A CHECK cannot be altered, and the old one rejects the new spelling: drop, update, re-add. */
  private respell(direction: "up" | "down") {
    for (const { table, column, from, to, others } of RESPELLINGS) {
      const [oldValue, newValue] = direction === "up" ? [from, to] : [to, from];
      this.schema.raw(`alter table ${table} drop constraint ${table}_${column}_check`);
      this.schema.raw(
        `update ${table} set ${column} = '${newValue}' where ${column} = '${oldValue}'`,
      );
      this.schema.raw(`alter table ${table} add ${check(table, column, [newValue, ...others])}`);
    }
  }

  override async up() {
    for (const { table, column, values } of CHECKS) {
      this.schema.raw(`alter table ${table} add ${check(table, column, values)}`);
    }
    this.respell("up");
    this.schema.raw(
      `alter table match_rounds
         drop constraint match_rounds_status_check,
         add ${check("match_rounds", "status", ["draft", "active"])}`,
    );
  }

  override async down() {
    for (const { table, column } of CHECKS) {
      this.schema.raw(`alter table ${table} drop constraint ${table}_${column}_check`);
    }
    this.respell("down");
  }
}
