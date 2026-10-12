import type { Branch, BranchSliceNode } from "@boklisten/backend/shared/branch";
import { Breadcrumbs, NavLink, Stack, Text, Title, Tree, useTree } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { Activity, useMemo, useState } from "react";

import { getBranchNodeShortLabel, toBranchTreeNodeData } from "@/shared/utils/branchTree";

const NO_BRANCHES: BranchSliceNode[] = [];

/**
 * The branch tree as a picker. `selectedBranchId` is the highlighted branch; when it changes from
 * outside (a link to another branch, the URL), the tree follows and expands the ancestors so the
 * branch is visible.
 *
 * Branches with `selectable: false` are the path above the viewer's home node. They are not part
 * of the tree: they read as a breadcrumb line above it, the way the order flow shows the way up,
 * so the home node sits at the top of the tree without a staircase of greyed rows over it. The
 * server decides which rows those are; nothing is computed here.
 */
export default function SelectBranchTreeView({
  label,
  branches,
  selectedBranchId = null,
  onSelect,
}: {
  label: string;
  branches: BranchSliceNode[];
  selectedBranchId?: string | null;
  onSelect: (branchId: string) => void;
}) {
  const [expandedState, setExpandedState] = useState<Record<string, boolean>>({});
  const tree = useTree({ expandedState, onExpandedStateChange: setExpandedState });
  // Memoised by hand: `Tree` re-initialises its expanded state whenever `data` is a new array,
  // which undoes every click if the nodes are rebuilt on each render, and the React Compiler
  // leaves this call alone (checked in the compiled output) because its result feeds the
  // render-phase state adjustment below. One shared empty list while the branches load, for the
  // same reason.
  const stableBranches = branches.length === 0 ? NO_BRANCHES : branches;
  const selectable = useMemo(
    () => stableBranches.filter((branch) => branch.selectable),
    [stableBranches],
  );
  const data = useMemo(() => toBranchTreeNodeData(selectable), [selectable]);
  const pathAbove = useMemo(() => connectorsAbove(stableBranches), [stableBranches]);

  // Open the top nodes once the branches arrive, so the page does not start on a single collapsed
  // row, and whenever the selected branch changes from outside (a link, the URL) open the path
  // down to it. Both are done during render (the "adjust state when a prop changes" pattern),
  // keyed so each runs once per change, and as one state update.
  const ancestors = selectedBranchId === null ? [] : ancestorIds(selectable, selectedBranchId);
  const toOpen = [...data.map((node) => node.value), ...ancestors];
  const openKey = toOpen.join(",");
  const [appliedOpenKey, setAppliedOpenKey] = useState("");
  if (openKey !== appliedOpenKey) {
    setAppliedOpenKey(openKey);
    if (!toOpen.every((id) => expandedState[id])) {
      setExpandedState({
        ...expandedState,
        ...Object.fromEntries(toOpen.map((id) => [id, true])),
      });
    }
  }

  return (
    <Stack>
      <Title order={3}>{label}</Title>
      {pathAbove.length > 0 && (
        <Breadcrumbs separator="›" separatorMargin="xs" style={{ flexWrap: "wrap", rowGap: 4 }}>
          {pathAbove.map((branch) => (
            <Text key={branch.id} size="sm" c="dimmed">
              {branch.localName ?? branch.name}
            </Text>
          ))}
        </Breadcrumbs>
      )}
      <Tree
        tree={tree}
        data={data}
        renderNode={({ node, expanded, hasChildren, elementProps }) => (
          <NavLink
            {...elementProps}
            label={getBranchNodeShortLabel(node)}
            onClick={(event) => {
              elementProps.onClick(event);
              onSelect(node.value);
            }}
            leftSection={
              <Activity mode={hasChildren ? "visible" : "hidden"}>
                <IconChevronRight
                  size={18}
                  style={{
                    transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                  }}
                />
              </Activity>
            }
            active={selectedBranchId === node.value}
          />
        )}
      />
    </Stack>
  );
}

/**
 * The non-selectable branches above the viewer's tree, top first: the parent chain of the first
 * selectable branch whose parent is not selectable (the home node), as far as the list holds it.
 */
function connectorsAbove(branches: BranchSliceNode[]): BranchSliceNode[] {
  const byId = new Map(branches.map((branch) => [branch.id, branch]));
  // A parent that is not in the list (the root, left out by `withoutRoot`) is nothing to show.
  const parentOf = (branch: BranchSliceNode) =>
    branch.parentBranchId === null ? undefined : byId.get(branch.parentBranchId);
  const home = branches
    .filter((branch) => {
      const parent = parentOf(branch);
      return branch.selectable && parent !== undefined && !parent.selectable;
    })
    .toSorted((a, b) => a.name.localeCompare(b.name, "nb"))[0];
  const path: BranchSliceNode[] = [];
  for (
    let parent = home === undefined ? undefined : parentOf(home);
    parent !== undefined && !parent.selectable;
    parent = parentOf(parent)
  ) {
    path.unshift(parent);
  }
  return path;
}

/** The ids above `branchId`, nearest first. */
function ancestorIds(branches: Branch[], branchId: string): string[] {
  const byId = new Map(branches.map((branch) => [branch.id, branch]));
  const ids: string[] = [];
  for (
    let parentId = byId.get(branchId)?.parentBranchId ?? null;
    parentId !== null;
    parentId = byId.get(parentId)?.parentBranchId ?? null
  ) {
    ids.push(parentId);
  }
  return ids;
}
