import { MultiSelect } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import useApiClient from "@/shared/hooks/useApiClient";

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
  const { api } = useApiClient();
  const { data: branches, isPending } = useQuery(api.branches.getAll.queryOptions());

  return (
    <MultiSelect
      label={label}
      placeholder={"Alle filialer"}
      searchable
      clearable
      disabled={isPending}
      value={value}
      onChange={onChange}
      data={branches?.map((branch) => ({ value: branch.id, label: branch.name })) ?? []}
    />
  );
}
