import type { Branch } from "@boklisten/backend/shared/branch";

import { normalize } from "@/features/search/searchPages";

/** One letter matches most branches; the rest are a keystroke away. */
const MAX_BRANCH_HITS = 8;

export interface BranchHit {
  branch: Branch;
  /** The branches above it, top first, by the name each has under its own parent. */
  path: string[];
}

function pathOf(branch: Branch, byId: Map<string, Branch>): string[] {
  const path: string[] = [];
  const seen = new Set([branch.id]);
  let parent = branch.parentBranchId === null ? undefined : byId.get(branch.parentBranchId);
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    path.unshift(parent.localName ?? parent.name);
    parent = parent.parentBranchId === null ? undefined : byId.get(parent.parentBranchId);
  }
  return path;
}

/**
 * Branches whose name matches the query, best first: name starts with it, then a word in the name
 * starts with it, then the name contains it. Within a tier, higher up the tree first, so "ullern"
 * finds the school before its year groups and classes, then alphabetical, as the branch list is.
 */
export function searchBranches(branches: Branch[], query: string): BranchHit[] {
  const term = normalize(query.trim());
  if (term.length === 0) {
    return [];
  }
  const tiers: ((name: string) => boolean)[] = [
    (name) => name.startsWith(term),
    (name) => name.split(/\s+/u).some((word) => word.startsWith(term)),
    (name) => name.includes(term),
  ];
  const byId = new Map(branches.map((branch) => [branch.id, branch]));
  const candidates = branches.map((branch) => ({
    hit: { branch, path: pathOf(branch, byId) },
    name: normalize(branch.name),
  }));
  const ranked: BranchHit[] = [];
  for (const matches of tiers) {
    const tier = candidates
      .filter(({ hit, name }) => !ranked.includes(hit) && matches(name))
      .map(({ hit }) => hit)
      .toSorted((a, b) => a.path.length - b.path.length);
    ranked.push(...tier);
    if (ranked.length >= MAX_BRANCH_HITS) {
      break;
    }
  }
  return ranked.slice(0, MAX_BRANCH_HITS);
}
