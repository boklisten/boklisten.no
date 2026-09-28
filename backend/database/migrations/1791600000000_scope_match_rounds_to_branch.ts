import { BaseSchema } from "@adonisjs/lucid/schema";

const TIME_COLUMNS = ["user_meeting_from", "user_meeting_to", "stand_from", "stand_to"];

/**
 * A round belongs to one branch and covers it and all its descendants, instead of holding a
 * hand-picked `branches text[]`. Two lists of ids had no FKs (`branches`,
 * `excluded_customer_ids`), so a deleted branch or user silently stayed in them. They become
 * junction tables, and what they mean changes too:
 * - `match_round_stand_branches`: descendants whose books (handed out or ordered there) all go
 *   via the stand.
 * - `match_round_stand_customers`: students who get no student matches. All their books go via
 *   the stand. They replace "excluded" students, who were left out of the round completely.
 *
 * An existing round gets the lowest branch whose subtree holds every branch it picked. Both rounds
 * on 2026-09-28 come out as Ullern videregående skole and are already generated. The wider scope
 * only matters if their matches are deleted and generated again (Adrian accepted this). Excluded
 * students become stand students.
 *
 * The four `HH:MM` strings become `time`, which Postgres checks for us.
 *
 * `include_customer_items_from_other_branches` is dropped: no round uses it (both are `false`).
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.alterTable("match_rounds", (table) => {
      table
        .string("branch_id", 24)
        .nullable()
        .references("id")
        .inTable("branches")
        .onDelete("RESTRICT");
      table.index(["branch_id"]);
    });

    // Every picked branch walks up to the root. The lowest common ancestor is the one reached from
    // every picked branch, in the fewest steps from the one farthest below it.
    this.schema.raw(`
      with recursive chain(round_id, picked_id, ancestor_id, steps) as (
        select match_rounds.id, picked.id, picked.id, 0
        from match_rounds, unnest(match_rounds.branches) as picked(id)
        union all
        select chain.round_id, chain.picked_id, branches.parent_branch_id, chain.steps + 1
        from chain
        join branches on branches.id = chain.ancestor_id
        where branches.parent_branch_id is not null
      ),
      lowest_common as (
        select distinct on (chain.round_id) chain.round_id, chain.ancestor_id
        from chain
        join match_rounds on match_rounds.id = chain.round_id
        group by chain.round_id, chain.ancestor_id, match_rounds.branches
        having count(distinct chain.picked_id) = cardinality(array(select distinct unnest(match_rounds.branches)))
        order by chain.round_id, max(chain.steps)
      )
      update match_rounds set branch_id = lowest_common.ancestor_id
      from lowest_common
      where match_rounds.id = lowest_common.round_id
    `);
    this.schema.alterTable("match_rounds", (table) => {
      table.string("branch_id", 24).notNullable().alter();
    });

    this.schema.createTable("match_round_stand_branches", (table) => {
      table
        .integer("round_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("match_rounds")
        .onDelete("CASCADE");
      table
        .string("branch_id", 24)
        .notNullable()
        .references("id")
        .inTable("branches")
        .onDelete("RESTRICT");
      table.primary(["round_id", "branch_id"]);
      table.index(["branch_id"]);
    });

    this.schema.createTable("match_round_stand_customers", (table) => {
      table
        .integer("round_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("match_rounds")
        .onDelete("CASCADE");
      table
        .string("customer_id", 24)
        .notNullable()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE");
      table.primary(["round_id", "customer_id"]);
      table.index(["customer_id"]);
    });
    this.schema.raw(`
      insert into match_round_stand_customers (round_id, customer_id)
      select distinct match_rounds.id, excluded.id
      from match_rounds, unnest(match_rounds.excluded_customer_ids) as excluded(id)
    `);

    this.schema.alterTable("match_rounds", (table) => {
      table.dropColumn("branches");
      table.dropColumn("excluded_customer_ids");
      table.dropColumn("include_customer_items_from_other_branches");
    });

    for (const column of TIME_COLUMNS) {
      this.schema.raw(
        `alter table match_rounds alter column ${column} type time using ${column}::time`,
      );
    }
    this.schema.raw(`
      alter table match_rounds
        add constraint match_rounds_user_meeting_window_check check (user_meeting_to > user_meeting_from),
        add constraint match_rounds_stand_window_check check (stand_to > stand_from)
    `);
  }

  /** Restores the arrays. A round's picks come back as its root plus every descendant. */
  override async down() {
    this.schema.raw(`
      alter table match_rounds
        drop constraint match_rounds_user_meeting_window_check,
        drop constraint match_rounds_stand_window_check
    `);
    for (const column of TIME_COLUMNS) {
      this.schema.raw(
        `alter table match_rounds alter column ${column} type varchar(5) using to_char(${column}, 'HH24:MI')`,
      );
    }

    this.schema.alterTable("match_rounds", (table) => {
      table.specificType("branches", "text[]").notNullable().defaultTo("{}");
      table.specificType("excluded_customer_ids", "text[]").notNullable().defaultTo("{}");
      table.boolean("include_customer_items_from_other_branches").notNullable().defaultTo(false);
    });
    this.schema.raw(`
      with recursive subtree(round_id, branch_id) as (
        select id, branch_id from match_rounds
        union all
        select subtree.round_id, branches.id
        from subtree
        join branches on branches.parent_branch_id = subtree.branch_id
      )
      update match_rounds set branches = picked.ids
      from (select round_id, array_agg(branch_id) as ids from subtree group by round_id) as picked
      where match_rounds.id = picked.round_id
    `);
    this.schema.raw("alter table match_rounds alter column branches drop default");
    this.schema.raw(`
      update match_rounds set excluded_customer_ids = stand.ids
      from (
        select round_id, array_agg(customer_id) as ids
        from match_round_stand_customers
        group by round_id
      ) as stand
      where match_rounds.id = stand.round_id
    `);

    this.schema.dropTable("match_round_stand_customers");
    this.schema.dropTable("match_round_stand_branches");
    this.schema.alterTable("match_rounds", (table) => {
      table.dropColumn("branch_id");
    });
  }
}
