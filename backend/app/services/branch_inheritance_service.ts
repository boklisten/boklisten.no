import { Exception } from "@adonisjs/core/exceptions";
import type { TransactionClientContract } from "@adonisjs/lucid/types/database";

import Branch, { overrideColumn } from "#models/branch";
import type { InheritedOverrides } from "#shared/branch";
import { INHERITED_BRANCH_FIELDS, descendantIds } from "#shared/branch-inheritance";
import type { InheritedBranchField } from "#shared/branch-inheritance";

/** `overrides` keyed by the model attributes that store them (`visibleToCustomersOverride`, …). */
export function overrideColumns(overrides: Partial<InheritedOverrides>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(overrides)
      .filter(([, value]) => value !== undefined)
      .map(([field, value]) => [`${field}Override`, value]),
  );
}

/**
 * Stores `changes` as the branch's overrides, `null` meaning "inherit", as given: an override
 * equal to the parent's value is still an override. The root cannot inherit, and it is never
 * visible to customers: it is a scope, not a school anyone orders from.
 */
export function applyOverrides(branch: Branch, changes: Partial<InheritedOverrides>): void {
  if (branch.isRoot && Object.values(changes).includes(null)) {
    throw new Exception(`${branch.name} er øverst i treet og kan ikke arve`, {
      status: 422,
      code: "E_ROOT_CANNOT_INHERIT",
    });
  }
  if (branch.isRoot && changes.visibleToCustomers === true) {
    throw new Exception(`${branch.name} kan ikke være synlig for kunder`, {
      status: 422,
      code: "E_ROOT_NOT_VISIBLE",
    });
  }
  branch.merge(overrideColumns(changes));
}

/** Every descendant of `branchId` inherits `field` again: their overrides are cleared. */
export async function inheritBelow(branchId: string, field: InheritedBranchField): Promise<void> {
  await Branch.whileLocked(async (trx) => {
    const ids = descendantIds(await loadTree(trx), branchId);
    if (ids.length > 0) {
      await trx
        .from("branches")
        .whereIn("id", ids)
        .update({ [overrideColumn(field)]: null });
    }
  });
}

type TreeRow = { id: string; parentBranchId: string | null } & InheritedOverrides;

function loadTree(trx: TransactionClientContract): Promise<TreeRow[]> {
  return trx
    .from("branches")
    .select(
      "id",
      "parent_branch_id as parentBranchId",
      ...INHERITED_BRANCH_FIELDS.map((field) => `${overrideColumn(field)} as ${field}`),
    );
}
