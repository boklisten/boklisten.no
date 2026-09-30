import { Exception } from "@adonisjs/core/exceptions";
import type { TransactionClientContract } from "@adonisjs/lucid/types/database";

import Branch from "#models/branch";
import BranchPeriod, { PERIOD_KINDS, PERIOD_LIST_BY_KIND } from "#models/branch_period";
import {
  ROOT_VALUES,
  applyOverrides,
  keepValuesInForce,
  overrideColumns,
} from "#services/branch_inheritance_service";
import type { Branch as BranchDto, BranchPeriods, InheritedOverrides } from "#shared/branch";
import { INHERITED_BRANCH_FIELDS } from "#shared/branch-inheritance";
import type { InheritedBranchField } from "#shared/branch-inheritance";

/** The columns an admin edits on a branch; the id and the tree position have their own flows. */
type BranchColumns = Omit<
  BranchDto,
  "id" | "parentBranchId" | "overrides" | InheritedBranchField | keyof BranchPeriods
>;

type BranchCreateInput = Pick<BranchColumns, "name"> &
  Partial<Pick<BranchColumns, "address">> & {
    /** `null` creates a root with `ROOT_VALUES`; under a parent every inherited field inherits. */
    parentBranchId: string | null;
  };

/** An inherited field set to a value overrides the parent's, even an equal one; `null` inherits again. */
type BranchUpdateInput = Partial<BranchColumns> &
  Partial<InheritedOverrides> &
  Partial<BranchPeriods>;

interface BranchRelationshipInput {
  id: string;
  localName?: string | null;
  childLabel?: string | null;
  /** `null` makes the branch a root; absent leaves the parent unchanged. */
  parentBranchId?: string | null;
  /** The complete list of children; absent leaves the children unchanged. */
  childBranchIds?: string[];
}

/** Thrown when a relationship update would make a branch its own ancestor. */
export class BranchCycleError extends Error {
  override name = "BranchCycleError";

  constructor(branchId: string) {
    super(`Cycle detected at branch ${branchId}`);
  }
}

export async function createBranch(input: BranchCreateInput): Promise<Branch> {
  return Branch.whileLocked(async (trx) => {
    const parent =
      input.parentBranchId === null
        ? null
        : await Branch.query({ client: trx }).where("id", input.parentBranchId).firstOrFail();
    const branch = await Branch.create(
      {
        name: input.name,
        address: input.address ?? null,
        parentBranchId: input.parentBranchId,
        ...(parent ? {} : overrideColumns(ROOT_VALUES)),
      },
      { client: trx },
    );
    // Read back so the values in force and the empty period lists are populated like on every
    // other read.
    return Branch.query({ client: trx }).where("id", branch.id).firstOrFail();
  });
}

/**
 * Applies a partial update. A period list that is present replaces the stored periods of that
 * kind wholesale (the form always sends the whole list); absent lists are left alone.
 */
export async function updateBranch(branchId: string, input: BranchUpdateInput): Promise<Branch> {
  const { rentPeriods, extendPeriods, partlyPaymentPeriods, ...rest } = input;
  const periods: Partial<BranchPeriods> = { rentPeriods, extendPeriods, partlyPaymentPeriods };
  const overrides: Partial<InheritedOverrides> = {};
  const columns: Partial<BranchColumns> = {};
  for (const [key, value] of Object.entries(rest)) {
    Object.assign(isInheritedField(key) ? overrides : columns, { [key]: value });
  }
  return Branch.whileLocked(async (trx) => {
    const branch = await lockedBranch(branchId, trx);
    branch.merge(definedEntries(columns));
    applyOverrides(branch, overrides);
    await branch.save();
    for (const kind of PERIOD_KINDS) {
      const list = periods[PERIOD_LIST_BY_KIND[kind]];
      if (list === undefined) {
        continue;
      }
      await BranchPeriod.query({ client: trx })
        .where("branch_id", branchId)
        .where("kind", kind)
        .delete();
      await BranchPeriod.createMany(
        BranchPeriod.rowsFor(branchId, { [PERIOD_LIST_BY_KIND[kind]]: list }),
        { client: trx },
      );
    }
    return lockedBranch(branchId, trx);
  });
}

/**
 * Moves a branch in the tree. `childBranchIds` is a command: the branches listed get this branch
 * as parent, and the branch's current children missing from the list become roots. What a moved
 * branch inherits it now inherits from its new parent, and its overrides stay; a branch that
 * becomes a root keeps the values it had in force as its own.
 */
export async function updateBranchRelationships(input: BranchRelationshipInput): Promise<Branch> {
  return Branch.whileLocked(async (trx) => {
    const branch = await lockedBranch(input.id, trx);
    const parentBranchId =
      input.parentBranchId === undefined ? branch.parentBranchId : input.parentBranchId;
    const currentChildIds = (
      await trx.from("branches").where("parent_branch_id", input.id).select("id")
    ).map((child: { id: string }) => child.id);
    const childBranchIds = input.childBranchIds ?? currentChildIds;
    await assertNoCycle(input.id, parentBranchId, childBranchIds, trx);
    await keepValuesInForce(trx, [
      ...(parentBranchId === null && branch.parentBranchId !== null ? [input.id] : []),
      ...(input.childBranchIds === undefined
        ? []
        : currentChildIds.filter((id) => !input.childBranchIds?.includes(id))),
    ]);

    branch.merge(
      definedEntries({
        localName: input.localName,
        childLabel: input.childLabel,
        parentBranchId,
      }),
    );
    await branch.save();

    if (input.childBranchIds !== undefined) {
      await Branch.query({ client: trx })
        .where("parent_branch_id", input.id)
        .whereNotIn("id", input.childBranchIds)
        .update({ parent_branch_id: null });
      if (input.childBranchIds.length > 0) {
        await Branch.query({ client: trx })
          .whereIn("id", input.childBranchIds)
          .update({ parent_branch_id: input.id });
      }
    }
    return lockedBranch(input.id, trx);
  });
}

async function lockedBranch(branchId: string, trx: TransactionClientContract): Promise<Branch> {
  return Branch.query({ client: trx }).where("id", branchId).forUpdate().firstOrFail();
}

/**
 * The branch must not become its own ancestor: neither directly, nor through the new parent's
 * chain of parents passing the branch or one of its (new) children.
 */
async function assertNoCycle(
  branchId: string,
  parentBranchId: string | null,
  childBranchIds: string[],
  trx: TransactionClientContract,
): Promise<void> {
  if (branchId === parentBranchId || childBranchIds.includes(branchId)) {
    throw new BranchCycleError(branchId);
  }
  const blocked = new Set([branchId, ...childBranchIds]);
  let currentId = parentBranchId;
  while (currentId !== null) {
    if (blocked.has(currentId)) {
      throw new BranchCycleError(currentId);
    }
    blocked.add(currentId);
    const current: { parentBranchId: string | null } | null = await trx
      .from("branches")
      .where("id", currentId)
      .select("parent_branch_id as parentBranchId")
      .first();
    if (!current) {
      throw new Exception(`Fant ikke filial ${currentId}`, {
        status: 404,
        code: "E_ROW_NOT_FOUND",
      });
    }
    currentId = current.parentBranchId;
  }
}

function isInheritedField(key: string): key is InheritedBranchField {
  return INHERITED_BRANCH_FIELDS.some((field) => field === key);
}

/** `merge` would store `undefined` for keys that were simply not sent, so they are dropped first. */
function definedEntries<T extends object>(values: T): Partial<T> {
  const defined = Object.entries(values).filter(([, value]) => value !== undefined);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- same keys, undefined values removed
  return Object.fromEntries(defined) as Partial<T>;
}
