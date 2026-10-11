import type { Branch } from "@boklisten/backend/shared/branch";
import { NavLink, Stack, Title, Tree, useTree } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { Activity, useMemo, useState } from "react";

import { getBranchNodeShortLabel, toBranchTreeNodeData } from "@/shared/utils/branchTree";

const NO_BRANCHES: Branch[] = [];

/**
 * The branch tree as a picker. `selectedBranchId` is the highlighted branch; when it changes from
 * outside (a link to another branch, the URL), the tree follows and expands the ancestors so the
 * branch is visible.
 */
export default function SelectBranchTreeView({
  label,
  branches,
  selectedBranchId = null,
  onSelect,
}: {
  label: string;
  branches: Branch[];
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
  const data = useMemo(() => toBranchTreeNodeData(stableBranches), [stableBranches]);

  // Open the top node ("Alle filialer") once the branches arrive, so the page does not start on a single
  // collapsed row, and whenever the selected branch changes from outside (a link, the URL) open
  // the path down to it. Both are done during render (the "adjust state when a prop changes"
  // pattern), keyed so each runs once per change, and as one state update.
  const ancestors = selectedBranchId === null ? [] : ancestorIds(branches, selectedBranchId);
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
