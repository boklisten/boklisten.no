import type { Branch } from "@boklisten/backend/shared/branch";
import { NavLink, Stack, Title, Tree } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { Activity, useState } from "react";

import { getBranchNodeShortLabel, toBranchTreeNodeData } from "@/shared/utils/branchTree";

export default function SelectBranchTreeView({
  label,
  branches,
  onSelect,
}: {
  label: string;
  branches: Branch[];
  onSelect: (branchId: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <Stack>
      <Title order={3}>{label}</Title>
      <Tree
        data={toBranchTreeNodeData(branches)}
        renderNode={({ node, expanded, hasChildren, elementProps }) => (
          <NavLink
            {...elementProps}
            label={getBranchNodeShortLabel(node)}
            onClick={(event) => {
              elementProps.onClick(event);
              setSelected(node.value);
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
            active={selected === node.value}
          />
        )}
      />
    </Stack>
  );
}
