import type { Branch } from "@boklisten/backend/shared/branch";
import {
  descendantIds,
  followers,
  resolveInherited,
} from "@boklisten/backend/shared/branch-inheritance";
import type {
  InheritanceInput,
  InheritedBranchField,
} from "@boklisten/backend/shared/branch-inheritance";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/shared/utils/apiClient";

export interface BranchRef {
  id: string;
  name: string;
}

/** A branch below the one being edited: its place in the tree, its value and whether it overrides. */
export interface DescendantInheritance<T> extends BranchRef {
  /** The name under its parent ("VG1" under Ullern videregående skole), as in the branch picker. */
  localName: string | null;
  parent: BranchRef;
  /** The value in force. */
  value: T;
  /** What the parent resolves to: the value this branch takes when it inherits. */
  parentValue: T;
  overridden: boolean;
}

/** Where one inherited field of a branch comes from, and who shares it, for the card around its control. */
export interface FieldInheritance<T> {
  /** The branch itself. */
  branch: BranchRef;
  /** The value in force at the branch (with the form's unsaved override when there is one). */
  value: T;
  /** What the branch stores: its own value, or `null` when it inherits. */
  override: T | null;
  /** The parent, its name under its own parent (as the branch picker shows it) and the value it resolves to; `null` at a root. */
  parent: (BranchRef & { localName: string | null; value: T }) | null;
  /** True when the branch has a parent and no override, so it follows the parent. */
  inherited: boolean;
  /** Every branch below this one, at any depth, parents before children. */
  descendants: DescendantInheritance<T>[];
  /** How many branches sit below this one, at any depth. */
  descendantCount: number;
  /** How many of them follow this branch through an unbroken chain of inheriting branches. */
  followingCount: number;
}

/**
 * Resolves one inherited field of `branchId` over the branch list the admin already has loaded,
 * with the rule in `shared/branch-inheritance.ts`. `draft` is the form's unsaved override
 * (`null` = inherit), and `pending` the overrides of branches below that are being saved, so what
 * the admin just chose is reflected at once, on the branch and on everything that follows it.
 * `undefined` until the branches have loaded.
 */
export default function useInheritedField<K extends InheritedBranchField>(
  branchId: string,
  field: K,
  draft?: Branch[K] | null,
  pending?: ReadonlyMap<string, Branch[K] | null>,
): FieldInheritance<Branch[K]> | undefined {
  const { data: branches } = useQuery(api.branches.index.queryOptions());
  if (!branches) {
    return undefined;
  }
  const tree = withCompleteAncestry(branches);
  const byId = new Map(tree.map((branch) => [branch.id, branch]));
  const branch = byId.get(branchId);
  if (!branch) {
    return undefined;
  }
  const overrideOf = (candidate: Branch): Branch[K] | null => {
    if (candidate.id === branchId && draft !== undefined) {
      return draft;
    }
    const saving = pending?.get(candidate.id);
    return saving === undefined ? candidate.overrides[field] : saving;
  };
  const inputs: InheritanceInput<Branch[K]>[] = tree.map((candidate) => ({
    id: candidate.id,
    parentBranchId: candidate.parentBranchId,
    // A draft `null` at a root is not a state the server accepts; show the stored value instead.
    override:
      candidate.parentBranchId === null
        ? (overrideOf(candidate) ?? candidate[field])
        : overrideOf(candidate),
  }));
  const resolved = resolveInherited(inputs);
  const overrideById = new Map(inputs.map((input) => [input.id, input.override]));
  const valueOf = (id: string): Branch[K] => {
    const entry = resolved.get(id);
    if (!entry) {
      throw new Error(`Branch ${id} is not in the tree`);
    }
    return entry.value;
  };
  const ref = (id: string): BranchRef => ({ id, name: byId.get(id)?.name ?? id });
  const parent = branch.parentBranchId === null ? undefined : byId.get(branch.parentBranchId);
  const override = overrideById.get(branchId) ?? null;
  const descendants = descendantIds(inputs, branchId).flatMap((id) => {
    const descendant = byId.get(id);
    // Every descendant has a parent; the guard only satisfies the types.
    if (!descendant || descendant.parentBranchId === null) {
      return [];
    }
    return [
      {
        ...ref(id),
        localName: descendant.localName,
        parent: ref(descendant.parentBranchId),
        value: valueOf(id),
        parentValue: valueOf(descendant.parentBranchId),
        overridden: (overrideById.get(id) ?? null) !== null,
      },
    ];
  });
  return {
    branch: ref(branchId),
    value: valueOf(branchId),
    override,
    parent: parent
      ? { ...ref(parent.id), localName: parent.localName, value: valueOf(parent.id) }
      : null,
    inherited: parent !== undefined && override === null,
    descendants,
    descendantCount: descendants.length,
    followingCount: followers(inputs, branchId).length,
  };
}

/**
 * The branches whose every ancestor is in the list. An admin sees the whole tree, so this is the
 * list itself; it only guards the resolver, which refuses a partial tree, against a viewer who
 * sees less.
 */
function withCompleteAncestry(branches: Branch[]): Branch[] {
  const byId = new Map(branches.map((branch) => [branch.id, branch]));
  const complete = new Map<string, boolean>();
  const isComplete = (branch: Branch): boolean => {
    const known = complete.get(branch.id);
    if (known !== undefined) {
      return known;
    }
    const parent = branch.parentBranchId === null ? null : byId.get(branch.parentBranchId);
    const result = parent === null || (parent !== undefined && isComplete(parent));
    complete.set(branch.id, result);
    return result;
  };
  return branches.filter(isComplete);
}
