import { BaseSchema } from "@adonisjs/lucid/schema";

import { newObjectId } from "#models/helpers/object_id";

/**
 * The branch tree gets one real root above the companies (step 2 of the branch scope plan,
 * 2026-10-11): "Alle filialer", divided into companies. Every branch that had no parent becomes its child,
 * and a partial unique index keeps it the only parentless row from here on. "Root" stays derived
 * (no parent), never a flag or an id in code.
 *
 * The root holds every inherited field itself, as the `*_override_at_root` checks require. The
 * values are what Boklisten.no AS held on the day; the companies keep their own overrides, so
 * nothing below the root changes what it inherits.
 */
const OVERRIDE_COLUMNS = [
  "visible_to_customers_override",
  "payment_responsible_override",
  "responsible_for_delivery_override",
  "buyout_percentage_override",
  "sell_percentage_override",
  "delivery_at_branch_override",
  "delivery_by_mail_override",
];

export default class extends BaseSchema {
  override async up() {
    const rootId = newObjectId();
    this.defer(async (db) => {
      await db.table("branches").insert({
        id: rootId,
        name: "Alle filialer",
        parent_branch_id: null,
        local_name: null,
        child_label: "selskap",
        address: null,
        visible_to_customers_override: false,
        payment_responsible_override: false,
        responsible_for_delivery_override: false,
        buyout_percentage_override: 1,
        sell_percentage_override: 0.33,
        delivery_at_branch_override: true,
        delivery_by_mail_override: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
      await db
        .from("branches")
        .whereNull("parent_branch_id")
        .whereNot("id", rootId)
        .update({ parent_branch_id: rootId });
    });
    this.schema.raw(`
      create unique index branches_single_root on branches ((parent_branch_id is null))
        where parent_branch_id is null
    `);
  }

  override async down() {
    this.schema.raw("drop index branches_single_root");
    this.defer(async (db) => {
      const root: { id: string } | null = await db
        .from("branches")
        .whereNull("parent_branch_id")
        .select("id")
        .first();
      if (root === null) {
        return;
      }
      // The children become roots and must hold every inherited field: where one inherits, the
      // root's value becomes its own, so nothing it had in force changes.
      for (const column of OVERRIDE_COLUMNS) {
        await db.rawQuery(
          `update branches child set ${column} = root.${column}
             from branches root
             where root.id = :rootId and child.parent_branch_id = root.id and child.${column} is null`,
          { rootId: root.id },
        );
      }
      await db
        .from("branches")
        .where("parent_branch_id", root.id)
        .update({ parent_branch_id: null });
      await db.from("branches").where("id", root.id).delete();
    });
  }
}
