import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * `active` and `branch_items_live_online` become one `visibility` (see `shared/branch-visibility.ts`):
 * `public` branches are shown everywhere and customers may order from them, `employee` branches
 * only to employees and admins, `admin` branches only to admins.
 *
 * The mapping, agreed with Adrian on 2026-09-28: an inactive branch becomes `admin`. An active
 * branch becomes `public` when it, an ancestor or a descendant was orderable online, so a school
 * stays pickable as a membership all the way down to its classes; every other active branch becomes
 * `employee`. Nothing is clamped to the ancestors: a class may be more public than its school.
 * On staging that gives 94 public, 10 employee and 11 admin branches. The order flow now lists
 * the public branches that have subject books: the 49 it listed before, less "Oslo innsamling",
 * which has no subjects.
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.alterTable("branches", (table) => {
      table.text("visibility").notNullable().defaultTo("employee");
    });
    this.schema.raw(`
      with recursive ancestry(id, ancestor_id) as (
        select id, id from branches
        union all
        select ancestry.id, branches.parent_branch_id
        from ancestry
        join branches on branches.id = ancestry.ancestor_id
        where branches.parent_branch_id is not null
      ),
      orderable as (
        select branches.id from branches where active and branch_items_live_online
      ),
      touches_orderable as (
        select ancestry.id from ancestry where ancestry.ancestor_id in (select id from orderable)
        union
        select ancestry.ancestor_id from ancestry where ancestry.id in (select id from orderable)
      )
      update branches set visibility = case
        when not active then 'admin'
        when id in (select id from touches_orderable) then 'public'
        else 'employee'
      end
    `);
    this.schema.raw(`
      alter table branches add constraint branches_visibility_check
        check (visibility in ('public', 'employee', 'admin'))
    `);
    this.schema.alterTable("branches", (table) => {
      table.dropColumn("active");
      table.dropColumn("branch_items_live_online");
    });
  }

  /** `public` branches come back orderable online; `admin` branches come back inactive. */
  override async down() {
    this.schema.alterTable("branches", (table) => {
      table.boolean("active").notNullable().defaultTo(true);
      table.boolean("branch_items_live_online").notNullable().defaultTo(false);
    });
    this.schema.raw(`
      update branches set
        active = visibility <> 'admin',
        branch_items_live_online = visibility = 'public'
    `);
    this.schema.alterTable("branches", (table) => {
      table.dropColumn("visibility");
    });
  }
}
