import Branch from "#models/branch";

/** Kept as a thin facade over the model helpers so the many callers read the same. */
export const BranchRelationshipService = {
  /** The classes (childless descendants) below a branch, e.g. every class of a school. */
  getLeafDescendants(branchId: string): Promise<{ id: string; name: string }[]> {
    return Branch.leafDescendants(branchId);
  },
  /** Every branch below a branch in the tree, excluding the branch itself. */
  getNestedChildBranchIds(branchId: string): Promise<string[]> {
    return Branch.descendantIds(branchId);
  },
};
