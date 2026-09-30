import type { PublicBranchNode, PublicBranchTree } from "@boklisten/backend/shared/branch";

export function nodeById(tree: PublicBranchTree, id: string): PublicBranchNode | undefined {
  return tree.nodes.find((node) => node.id === id);
}

/** The next step's choices; `null` lists the top of the tree. Already in name order. */
export function childrenOf(tree: PublicBranchTree, parentId: string | null): PublicBranchNode[] {
  return tree.nodes.filter((node) => node.parentBranchId === parentId);
}

/** The branches above `node`, top first, then the node itself. */
export function pathTo(tree: PublicBranchTree, node: PublicBranchNode): PublicBranchNode[] {
  const path = [node];
  let current = node;
  while (current.parentBranchId !== null) {
    const parent = nodeById(tree, current.parentBranchId);
    if (!parent) {
      break;
    }
    path.unshift(parent);
    current = parent;
  }
  return path;
}

/** The name a branch goes by among its siblings. */
export function shortName(node: PublicBranchNode): string {
  return node.localName ?? node.name;
}

/** What the children of `parent` (or of the hidden root) are called, for the step's title. */
export function stepLabel(tree: PublicBranchTree, parent: PublicBranchNode | null): string {
  return (parent ? parent.childLabel : tree.topLabel) ?? "skole";
}
