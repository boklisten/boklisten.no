import type { Branch } from "@boklisten/backend/shared/branch";
import { NavLink, Stack, Title, Tree, useTree } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { Activity, useState } from "react";

import { getBranchNodeShortLabel, toBranchTreeNodeData } from "@/shared/utils/branchTree";

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

  // When the selected branch changes from outside, open the path down to it. Done during render
  // (the "adjust state when a prop changes" pattern), keyed on the ancestor list so it runs once
  // per change and also once the branches have loaded.
  const ancestors = selectedBranchId === null ? [] : ancestorIds(branches, selectedBranchId);
  const ancestorKey = ancestors.join(",");
  const [appliedAncestorKey, setAppliedAncestorKey] = useState("");
  if (ancestorKey !== appliedAncestorKey) {
    setAppliedAncestorKey(ancestorKey);
    if (!ancestors.every((id) => expandedState[id])) {
      setExpandedState({
        ...expandedState,
        ...Object.fromEntries(ancestors.map((id) => [id, true])),
      });
    }
  }

  return (
    <Stack>
      <Title order={3}>{label}</Title>
      <Tree
        tree={tree}
        data={toBranchTreeNodeData(branches)}
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
