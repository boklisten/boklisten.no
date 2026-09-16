import type { Branch } from "@boklisten/backend/shared/branch";
import type { TreeNodeData } from "@mantine/core";

/** The branch tree as Mantine tree nodes: roots are the branches whose parent is not in the list. */
export function toBranchTreeNodeData(branches: Branch[]) {
  const branchIds = new Set(branches.map((branch) => branch.id));
  const childrenOf = Map.groupBy(
    branches.filter(
      (branch) => branch.parentBranchId !== null && branchIds.has(branch.parentBranchId),
    ),
    (branch) => branch.parentBranchId,
  );

  const toNode = (branch: Branch): TreeNodeData => ({
    value: branch.id,
    label: branch.name,
    nodeProps: { shortLabel: branch.localName ?? branch.name },
    children: (childrenOf.get(branch.id) ?? []).map(toNode).toSorted(byShortLabel),
  });

  return branches
    .filter((branch) => branch.parentBranchId === null || !branchIds.has(branch.parentBranchId))
    .map(toNode)
    .toSorted(byShortLabel);
}

function byShortLabel(a: TreeNodeData, b: TreeNodeData) {
  return getBranchNodeShortLabel(a).localeCompare(getBranchNodeShortLabel(b));
}

export function getBranchNodeShortLabel(node: TreeNodeData): string {
  return node.nodeProps?.["shortLabel"] ?? node.label;
}
