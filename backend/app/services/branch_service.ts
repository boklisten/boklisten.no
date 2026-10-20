import { Exception } from "@adonisjs/core/exceptions";
import type { TransactionClientContract } from "@adonisjs/lucid/types/database";

import Branch from "#models/branch";
import BranchPeriod, { PERIOD_KINDS, PERIOD_LIST_BY_KIND } from "#models/branch_period";
import { applyOverrides } from "#services/branch_inheritance_service";
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
    /** The branch to create under; every inherited field inherits from it. The root came from a migration. */
    parentBranchId: string;
  };

/** An inherited field set to a value overrides the parent's, even an equal one; `null` inherits again. */
type BranchUpdateInput = Partial<BranchColumns> &
  Partial<InheritedOverrides> &
  Partial<BranchPeriods>;

interface BranchRelationshipInput {
  id: string;
  localName?: string | null;
  childLabel?: string | null;
  /**
   * The complete list of children; absent leaves the children unchanged. A current child missing
   * from the list is refused: no branch can be left without a parent.
   */
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
    await Branch.query({ client: trx }).where("id", input.parentBranchId).firstOrFail();
    const branch = await Branch.create(
      {
        name: input.name,
        address: input.address ?? null,
        parentBranchId: input.parentBranchId,
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
 * Moves branches in the tree. `childBranchIds` is a command: the branches listed get this branch
 * as parent, leaving their old one. What a moved branch inherits it now inherits from its new
 * parent, and its overrides stay. A child cannot be dropped from the list, since that would leave
 * it without a parent; it leaves by being added to another branch.
 */
export async function updateBranchRelationships(input: BranchRelationshipInput): Promise<Branch> {
  return Branch.whileLocked(async (trx) => {
    const branch = await lockedBranch(input.id, trx);
    const currentChildIds = (
      await trx.from("branches").where("parent_branch_id", input.id).select("id")
    ).map((child: { id: string }) => child.id);
    const childBranchIds = input.childBranchIds ?? currentChildIds;
    await assertNoCycle(input.id, branch.parentBranchId, childBranchIds, trx);
    const detached = currentChildIds.filter((id) => !childBranchIds.includes(id));
    if (detached.length > 0) {
      const names = await Branch.namesByIds(detached);
      throw new Exception(
        `${[...names.values()].join(", ")} kan ikke løsrives fra treet; flytt heller til en annen filial`,
        { status: 422, code: "E_BRANCH_CANNOT_BE_DETACHED" },
      );
    }

    branch.merge(
      definedEntries({
        localName: input.localName,
        childLabel: input.childLabel,
      }),
    );
    await branch.save();

    if (input.childBranchIds !== undefined && input.childBranchIds.length > 0) {
      await Branch.query({ client: trx })
        .whereIn("id", input.childBranchIds)
        .update({ parent_branch_id: input.id });
    }
    return lockedBranch(input.id, trx);
  });
}

/**
 * The root is a scope, never a place: nothing is ordered from, handed out at, delivered to, put on
 * a waiting list at or matched at "Alle filialer". Called wherever a request sets a place-anchored branch.
 */
export async function assertNotRoot(branchId: string): Promise<void> {
  const root = await Branch.root();
  if (branchId === root.id) {
    throw new Exception(`Velg en filial under ${root.name}`, {
      status: 400,
      code: "E_ROOT_IS_NOT_A_PLACE",
    });
  }
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
