import db from "@adonisjs/lucid/services/db";
import type { TransactionClientContract } from "@adonisjs/lucid/types/database";

import Branch from "#models/branch";
import BranchPeriod, { PERIOD_KINDS, PERIOD_LIST_BY_KIND } from "#models/branch_period";
import type { Branch as BranchDto, BranchPeriods } from "#shared/branch";

/** The columns an admin edits on a branch; the id and the tree position have their own flows. */
export type BranchColumns = Omit<BranchDto, "id" | "parentBranchId" | keyof BranchPeriods>;

export type BranchCreateInput = Pick<BranchColumns, "name" | "type" | "region"> &
  Partial<Pick<BranchColumns, "logo" | "address">>;

export type BranchUpdateInput = Partial<BranchColumns> & Partial<BranchPeriods>;

export interface BranchRelationshipInput {
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
  const branch = await Branch.create({
    name: input.name,
    logo: input.logo ?? null,
    region: input.region,
    address: input.address ?? null,
    type: input.type,
  });
  // Read back so the column defaults (`active`, percentages, …) and the empty period lists are
  // populated like on every other read.
  return Branch.findOrFail(branch.id);
}

/**
 * Applies a partial update. A period list that is present replaces the stored periods of that
 * kind wholesale (the form always sends the whole list); absent lists are left alone.
 */
export async function updateBranch(branchId: string, input: BranchUpdateInput): Promise<Branch> {
  const { rentPeriods, extendPeriods, partlyPaymentPeriods, ...columns } = input;
  const periods: Partial<BranchPeriods> = { rentPeriods, extendPeriods, partlyPaymentPeriods };
  return db.transaction(async (trx) => {
    const branch = await lockedBranch(branchId, trx);
    branch.merge(definedEntries(columns));
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
    await branch.load("periods", (query) => void query.orderBy("id"));
    return branch;
  });
}

/**
 * Moves a branch in the tree. `childBranchIds` is a command: the branches listed get this branch
 * as parent, and the branch's current children missing from the list become roots.
 */
export async function updateBranchRelationships(input: BranchRelationshipInput): Promise<Branch> {
  return db.transaction(async (trx) => {
    const branch = await lockedBranch(input.id, trx);
    const parentBranchId =
      input.parentBranchId === undefined ? branch.parentBranchId : input.parentBranchId;
    const childBranchIds =
      input.childBranchIds ??
      (await Branch.query({ client: trx }).where("parent_branch_id", input.id)).map(
        (child) => child.id,
      );
    await assertNoCycle(input.id, parentBranchId, childBranchIds, trx);

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
    return branch;
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
    const current = await Branch.query({ client: trx }).where("id", currentId).firstOrFail();
    currentId = current.parentBranchId;
  }
}

/** `merge` would store `undefined` for keys that were simply not sent, so they are dropped first. */
function definedEntries<T extends object>(values: T): Partial<T> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- same keys, undefined values removed
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
