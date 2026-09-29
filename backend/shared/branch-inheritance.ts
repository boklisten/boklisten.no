/**
 * How the branch tree's inherited fields resolve, shared by the backend (the value in force of
 * every branch it reads) and the frontend (where each control's value comes from and who shares
 * it). Pure data-in data-out; `branch_inheritance.spec.ts` doubles as the specification.
 *
 * Each branch stores an *override* per field, or `null` to *inherit* the parent's value. A root
 * always holds a value (a check constraint enforces it). An override is the branch's value until
 * an admin clears it, whatever changes above, even when it happens to equal the parent's. The
 * branch whose override a branch's value comes from is its *source*; the *followers* of a branch
 * are the descendants that take its value through an unbroken chain of `null`s.
 */

export const INHERITED_BRANCH_FIELDS = [
  "visibility",
  "deliveryAtBranch",
  "deliveryByMail",
  "paymentResponsible",
  "responsibleForDelivery",
  "buyoutPercentage",
  "sellPercentage",
] as const;
export type InheritedBranchField = (typeof INHERITED_BRANCH_FIELDS)[number];

/** A branch's place in the tree. */
export interface TreeNode {
  id: string;
  parentBranchId: string | null;
}

/** A branch as the resolver sees it: its parent and what it stores. */
export interface InheritanceInput<T> extends TreeNode {
  /** The branch's own value, or `null` when it inherits. */
  override: T | null;
}

export interface Resolved<T> {
  id: string;
  /** The value in force. */
  value: T;
  /** The branch whose override `value` is; equals `id` when the branch overrides (or is a root). */
  sourceId: string;
}

/**
 * Resolves the value in force and the source of every branch. Throws when a parent is missing
 * from the input, because that means the caller loaded a partial tree, and when a root inherits,
 * which the database does not allow.
 */
export function resolveInherited<T>(branches: InheritanceInput<T>[]): Map<string, Resolved<T>> {
  const byId = new Map(branches.map((branch) => [branch.id, branch]));
  const resolved = new Map<string, Resolved<T>>();

  const resolve = (branch: InheritanceInput<T>): Resolved<T> => {
    const known = resolved.get(branch.id);
    if (known) {
      return known;
    }
    let result: Resolved<T>;
    if (branch.override !== null) {
      result = { id: branch.id, value: branch.override, sourceId: branch.id };
    } else {
      if (branch.parentBranchId === null) {
        throw new Error(`Branch ${branch.id} is a root without a value`);
      }
      const parent = byId.get(branch.parentBranchId);
      if (!parent) {
        throw new Error(`Branch ${branch.id}: parent ${branch.parentBranchId} is not in the tree`);
      }
      const { value, sourceId } = resolve(parent);
      result = { id: branch.id, value, sourceId };
    }
    resolved.set(branch.id, result);
    return result;
  };

  for (const branch of branches) {
    resolve(branch);
  }
  return resolved;
}

/** The ids below `branchId`, at any depth, parents before children. */
export function descendantIds(branches: TreeNode[], branchId: string): string[] {
  const childrenOf = Map.groupBy(branches, (branch) => branch.parentBranchId);
  const ids: string[] = [];
  const queue = [...(childrenOf.get(branchId) ?? [])];
  for (let branch = queue.shift(); branch; branch = queue.shift()) {
    ids.push(branch.id);
    queue.push(...(childrenOf.get(branch.id) ?? []));
  }
  return ids;
}

/** The descendants of `branchId` that hold an override. */
export function overridingDescendants<T>(
  branches: InheritanceInput<T>[],
  branchId: string,
): string[] {
  const byId = new Map(branches.map((branch) => [branch.id, branch]));
  return descendantIds(branches, branchId).filter(
    (id) => (byId.get(id)?.override ?? null) !== null,
  );
}

/**
 * The descendants that take `branchId`'s value through an unbroken chain of inheriting branches,
 * so a new value at `branchId` reaches exactly these.
 */
export function followers<T>(branches: InheritanceInput<T>[], branchId: string): string[] {
  const resolved = resolveInherited(branches);
  const sourceId = resolved.get(branchId)?.sourceId;
  return descendantIds(branches, branchId).filter((id) => resolved.get(id)?.sourceId === sourceId);
}
