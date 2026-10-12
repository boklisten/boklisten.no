import { TreeSelect } from "@mantine/core";
import type { TreeSelectProps } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/shared/utils/apiClient";
import { rootOf, toBranchTreeNodeData, withoutRoot } from "@/shared/utils/branchTree";

/**
 * The branch an employee works from. The root is offered first as a choice of its own, under its
 * own name ("Alle filialer"), because here it means "works everywhere" rather than "no school".
 * Any node below it can be picked, parents included, so the chevron alone expands.
 */
export default function EmployeeBranchPicker({
  value,
  onChange,
  ...props
}: Omit<TreeSelectProps, "data" | "value" | "onChange"> & {
  value: string;
  onChange: (branchId: string) => void;
}) {
  const { data: branches } = useQuery(api.branches.index.queryOptions());
  const root = rootOf(branches ?? []);
  const data = [
    ...(root ? [{ value: root.id, label: root.name }] : []),
    ...toBranchTreeNodeData(withoutRoot(branches ?? [])),
  ];
  return (
    <TreeSelect
      placeholder="Velg filial"
      data={data}
      searchable
      nothingFoundMessage="Fant ingen filialer"
      allowDeselect={false}
      {...props}
      // Wait for the branch data to be present so we can render its name
      value={branches ? value : null}
      onChange={(branchId) => {
        if (branchId !== null && branchId !== value) {
          onChange(branchId);
        }
      }}
    />
  );
}
