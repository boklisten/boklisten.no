import { MultiSelect } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/shared/utils/apiClient";

interface BranchMultiSelectProps {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
}

export default function BranchMultiSelect({
  value,
  onChange,
  label = "Filial",
}: BranchMultiSelectProps) {
  const { data: branches, isPending } = useQuery(api.branches.index.queryOptions());

  return (
    <MultiSelect
      label={label}
      placeholder="Alle filialer"
      searchable
      clearable
      disabled={isPending}
      value={value}
      onChange={onChange}
      data={branches?.map((branch) => ({ value: branch.id, label: branch.name })) ?? []}
    />
  );
}
