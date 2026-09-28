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

  // A top-level node has no parent shown above it to give its local name ("VG1") context, which
  // happens when the viewer may not see the parent; it goes by its full name.
  const toNode = (branch: Branch, topLevel: boolean): TreeNodeData => ({
    value: branch.id,
    label: branch.name,
    nodeProps: { shortLabel: topLevel ? branch.name : (branch.localName ?? branch.name) },
    children: (childrenOf.get(branch.id) ?? [])
      .map((child) => toNode(child, false))
      .toSorted(byShortLabel),
  });

  return branches
    .filter((branch) => branch.parentBranchId === null || !branchIds.has(branch.parentBranchId))
    .map((branch) => toNode(branch, true))
    .toSorted(byShortLabel);
}

/** Every branch below `rootId`, the root itself left out. */
export function descendantsOf(branches: Branch[], rootId: string): Branch[] {
  const childrenOf = Map.groupBy(branches, (branch) => branch.parentBranchId);
  const below: Branch[] = [];
  const queue = [...(childrenOf.get(rootId) ?? [])];
  for (let branch = queue.shift(); branch; branch = queue.shift()) {
    below.push(branch);
    queue.push(...(childrenOf.get(branch.id) ?? []));
  }
  return below;
}

/** The branches that pass `keep`, plus every ancestor of theirs, so the tree keeps its grouping. */
export function withAncestors(branches: Branch[], keep: (branch: Branch) => boolean): Branch[] {
  const byId = new Map(branches.map((branch) => [branch.id, branch]));
  const kept = new Set<string>();
  for (const branch of branches.filter(keep)) {
    for (
      let current: Branch | undefined = branch;
      current && !kept.has(current.id);
      current = current.parentBranchId === null ? undefined : byId.get(current.parentBranchId)
    ) {
      kept.add(current.id);
    }
  }
  return branches.filter((branch) => kept.has(branch.id));
}

function byShortLabel(a: TreeNodeData, b: TreeNodeData) {
  return getBranchNodeShortLabel(a).localeCompare(getBranchNodeShortLabel(b));
}

export function getBranchNodeShortLabel(node: TreeNodeData): string {
  return node.nodeProps?.["shortLabel"] ?? node.label;
}
