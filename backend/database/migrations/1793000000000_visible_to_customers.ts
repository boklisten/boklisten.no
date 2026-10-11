import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Visibility becomes one question, "is this branch visible to customers?" (decided with Adrian on
 * 2026-10-11, step 1 of the branch scope plan): the three-level `visibility_override` text
 * (`public` | `employee` | `admin`) becomes the boolean `visible_to_customers_override`, still
 * NULL where the branch inherits. Which branches an employee sees is the home node's job (later
 * steps), so `admin` and `employee` both become "not visible to customers".
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.raw(`
      alter table branches
        drop constraint branches_visibility_check,
        drop constraint branches_visibility_override_at_root;
      alter table branches
        alter column visibility_override type boolean using (visibility_override = 'public');
      alter table branches rename column visibility_override to visible_to_customers_override;
      alter table branches add constraint branches_visible_to_customers_override_at_root
        check (parent_branch_id is not null or visible_to_customers_override is not null);
    `);
  }

  override async down() {
    this.schema.raw(`
      alter table branches drop constraint branches_visible_to_customers_override_at_root;
      alter table branches rename column visible_to_customers_override to visibility_override;
      alter table branches
        alter column visibility_override type text
          using (case visibility_override when true then 'public' when false then 'employee' end);
      alter table branches
        add constraint branches_visibility_check
          check (visibility_override in ('public', 'employee', 'admin')),
        add constraint branches_visibility_override_at_root
          check (parent_branch_id is not null or visibility_override is not null);
    `);
  }
}
