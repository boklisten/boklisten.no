import type { Branch } from "@boklisten/backend/shared/branch";
import type { TreeNodeData } from "@mantine/core";

export function toBranchTreeNodeData(branches: Branch[]) {
  const branchById = new Map(branches.map((b) => [b.id, b]));

  const toNode = (branch: Branch) => ({
    value: branch.id,
    label: branch.name,
    nodeProps: { shortLabel: branch.localName ?? branch.name },
    children: createChildren(branch),
  });

  function createChildren(branch: Branch): TreeNodeData[] {
    return (branch.childBranches ?? [])
      .map((childBranchId) => branchById.get(childBranchId))
      .filter((childBranch) => childBranch !== undefined)
      .map(toNode)
      .sort(byShortLabel);
  }

  return branches
    .filter((branch) => !branch.parentBranch)
    .map(toNode)
    .sort(byShortLabel);
}

function byShortLabel(a: TreeNodeData, b: TreeNodeData) {
  return getBranchNodeShortLabel(a).localeCompare(getBranchNodeShortLabel(b));
}

export function getBranchNodeShortLabel(node: TreeNodeData): string {
  return node.nodeProps?.["shortLabel"] ?? node.label;
}
