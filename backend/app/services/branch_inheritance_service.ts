import { Exception } from "@adonisjs/core/exceptions";
import type { TransactionClientContract } from "@adonisjs/lucid/types/database";

import Branch, { overrideColumn } from "#models/branch";
import type { InheritedOverrides, InheritedValues } from "#shared/branch";
import {
  INHERITED_BRANCH_FIELDS,
  descendantIds,
  resolveInherited,
} from "#shared/branch-inheritance";
import type { InheritanceInput, InheritedBranchField } from "#shared/branch-inheritance";

/** What a new root holds; a branch created under a parent inherits every field instead. */
export const ROOT_VALUES: InheritedValues = {
  visibility: "employee",
  deliveryAtBranch: true,
  deliveryByMail: true,
  paymentResponsible: false,
  responsibleForDelivery: false,
  buyoutPercentage: 1,
  sellPercentage: 1,
};

/** `overrides` keyed by the model attributes that store them (`visibilityOverride`, …). */
export function overrideColumns(overrides: Partial<InheritedOverrides>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(overrides)
      .filter(([, value]) => value !== undefined)
      .map(([field, value]) => [`${field}Override`, value]),
  );
}

/**
 * Stores `changes` as the branch's overrides, `null` meaning "inherit", as given: an override
 * equal to the parent's value is still an override. A root cannot inherit.
 */
export function applyOverrides(branch: Branch, changes: Partial<InheritedOverrides>): void {
  if (branch.parentBranchId === null && Object.values(changes).includes(null)) {
    throw new Exception(`${branch.name} er øverst i treet og kan ikke arve`, {
      status: 422,
      code: "E_ROOT_CANNOT_INHERIT",
    });
  }
  branch.merge(overrideColumns(changes));
}

/**
 * `ids` are about to become roots, which must hold a value: where one of them inherits, the value
 * in force becomes its own, so a branch that loses its parent keeps what it had. Runs before the
 * move.
 */
export async function keepValuesInForce(
  trx: TransactionClientContract,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const tree = await loadTree(trx);
  const resolvedByField = INHERITED_BRANCH_FIELDS.map(
    (field) => [field, resolveInherited(inputsFor(tree, field))] as const,
  );
  for (const row of tree.filter((candidate) => ids.includes(candidate.id))) {
    const inherited = resolvedByField.filter(([field]) => row[field] === null);
    if (inherited.length > 0) {
      await trx
        .from("branches")
        .where("id", row.id)
        .update(
          Object.fromEntries(
            inherited.map(([field, resolved]) => [
              overrideColumn(field),
              resolved.get(row.id)?.value,
            ]),
          ),
        );
    }
  }
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

function inputsFor(tree: TreeRow[], field: InheritedBranchField): InheritanceInput<unknown>[] {
  return tree.map((row) => ({
    id: row.id,
    parentBranchId: row.parentBranchId,
    override: row[field],
  }));
}
