import { Badge, Group, Tooltip } from "@mantine/core";
import { IconBuildingStore, IconHierarchy3, IconSum } from "@tabler/icons-react";

/**
 * The compact form of the three branch-scope counts, shown on every tree row. When the branch has
 * no descendants with books the split is meaningless, so only the total is shown.
 */
export default function BranchBooksCountBadges({
  direct,
  indirect,
  total,
  showScopeSplit,
}: {
  direct: number;
  indirect: number;
  total: number;
  showScopeSplit: boolean;
}) {
  if (!showScopeSplit) {
    return (
      <Badge variant={"light"} color={"gray"} leftSection={<IconSum size={12} />}>
        {total}
      </Badge>
    );
  }
  return (
    <Group gap={4} wrap={"nowrap"}>
      <Tooltip label={"Denne filialen"}>
        <Badge variant={"light"} color={"blue"} leftSection={<IconBuildingStore size={12} />}>
          {direct}
        </Badge>
      </Tooltip>
      <Tooltip label={"Underliggende filialer"}>
        <Badge variant={"light"} color={"grape"} leftSection={<IconHierarchy3 size={12} />}>
          {indirect}
        </Badge>
      </Tooltip>
      <Tooltip label={"Totalt"}>
        <Badge variant={"light"} color={"gray"} leftSection={<IconSum size={12} />}>
          {total}
        </Badge>
      </Tooltip>
    </Group>
  );
}
