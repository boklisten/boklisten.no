import type { Branch } from "@boklisten/backend/shared/branch";
import { ThemeIcon, TreeSelect } from "@mantine/core";
import { IconHierarchy2 } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import { StandRuleGroup, StandRuleRow } from "@/features/matches/rounds/standRules/StandRuleGroup";
import { api } from "@/shared/utils/apiClient";
import { descendantsOf, toBranchTreeNodeData } from "@/shared/utils/branchTree";

function subBranchCount(branches: Branch[], branchId: string): string | undefined {
  const count = descendantsOf(branches, branchId).length;
  if (count === 0) {
    return undefined;
  }
  return count === 1 ? "Med 1 underfilial" : `Med ${count} underfilialer`;
}

/**
 * Picks the branches under the round's branch whose books all go via the stand.
 *
 * The tree stores the highest checked branch ("parent" strategy): checking a program, or every
 * class in it, stores the program, which the backend expands to its whole subtree.
 */
export default function StandBranchesField({
  rootBranchId,
  value,
  onChange,
}: {
  rootBranchId: string;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data: branches = [] } = useQuery(api.branches.index.queryOptions());
  const below = descendantsOf(branches, rootBranchId);
  const byId = new Map(below.map((branch) => [branch.id, branch]));
  const chosen = value.flatMap((id) => byId.get(id) ?? []);

  return (
    <StandRuleGroup
      title="Underfilialer"
      count={chosen.length}
      addControl={
        <TreeSelect
          mode="checkbox"
          checkedStrategy="parent"
          aria-label="Velg underfilialer som skal via stand"
          placeholder={
            below.length === 0 ? "Filialen har ingen underfilialer" : "Velg underfilialer"
          }
          disabled={below.length === 0}
          searchable
          nothingFoundMessage="Fant ingen filialer"
          // The chosen branches are listed as rows above, so the input only counts them.
          maxDisplayedValues={0}
          maxDisplayedValuesContent={(count) => `${count} valgt`}
          data={toBranchTreeNodeData(below)}
          value={value}
          onChange={onChange}
          comboboxProps={{ zIndex: 400 }}
        />
      }
    >
      {chosen.map((branch) => (
        <StandRuleRow
          key={branch.id}
          leading={
            // The size of a customer avatar, so branch and student rows line up.
            <ThemeIcon variant="light" color="teal" size={38} radius="xl">
              <IconHierarchy2 size={18} />
            </ThemeIcon>
          }
          title={branch.name}
          description={subBranchCount(branches, branch.id)}
          removeLabel={`Fjern ${branch.name}`}
          onRemove={() => onChange(value.filter((id) => id !== branch.id))}
        />
      ))}
    </StandRuleGroup>
  );
}
