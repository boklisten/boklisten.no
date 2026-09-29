import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * The inherited branch fields become overrides (decided with Adrian on 2026-09-29): each column is
 * renamed to `<column>_override` and holds the branch's own value, or NULL to inherit the
 * parent's (see `shared/branch-inheritance.ts`). A root always holds a value.
 *
 * Until now every column held the value in force, so a child with the same value as its parent
 * was inheriting it; those become NULL. One UPDATE per column reads the rows as they were before
 * the statement, so a grandchild is compared with its parent's old value, which is the value in
 * force. `down()` writes the resolved values back.
 */
const COLUMNS: { column: string; default: string }[] = [
  { column: "visibility", default: "'employee'" },
  { column: "delivery_at_branch", default: "true" },
  { column: "delivery_by_mail", default: "true" },
  { column: "payment_responsible", default: "false" },
  { column: "responsible_for_delivery", default: "false" },
  { column: "buyout_percentage", default: "1" },
  { column: "sell_percentage", default: "1" },
];

export default class extends BaseSchema {
  override async up() {
    for (const { column } of COLUMNS) {
      const override = `${column}_override`;
      this.schema.raw(`
        alter table branches rename column ${column} to ${override};
        alter table branches alter column ${override} drop not null, alter column ${override} drop default;
        update branches child set ${override} = null
          from branches parent
          where child.parent_branch_id = parent.id and child.${override} = parent.${override};
        alter table branches add constraint branches_${override}_at_root
          check (parent_branch_id is not null or ${override} is not null);
      `);
    }
  }

  override async down() {
    for (const { column, default: defaultValue } of COLUMNS) {
      const override = `${column}_override`;
      this.schema.raw(`
        alter table branches drop constraint branches_${override}_at_root;
        with recursive resolved(id, value) as (
          select id, ${override} from branches where parent_branch_id is null
          union all
          select child.id, coalesce(child.${override}, resolved.value)
          from branches child join resolved on child.parent_branch_id = resolved.id
        )
        update branches set ${override} = resolved.value from resolved where branches.id = resolved.id;
        alter table branches alter column ${override} set not null, alter column ${override} set default ${defaultValue};
        alter table branches rename column ${override} to ${column};
      `);
    }
  }
}
