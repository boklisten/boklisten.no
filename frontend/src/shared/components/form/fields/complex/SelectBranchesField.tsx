import { TreeSelect, type TreeSelectProps } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import { useFieldContext } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";
import { toBranchTreeNodeData } from "@/shared/utils/branchTree";

export default function SelectBranchesField(
  props: Omit<TreeSelectProps<"checkbox">, "data" | "mode" | "value" | "onChange">,
) {
  const field = useFieldContext<string[]>();
  const { api } = useApiClient();
  const { data: branches } = useQuery(api.branches.getAll.queryOptions());

  return (
    <TreeSelect
      mode={"checkbox"}
      checkedStrategy={"all"}
      label={"Filialer"}
      placeholder={"Velg filialer"}
      nothingFoundMessage={"Fant ingen filialer"}
      maxDisplayedValues={6}
      maxDisplayedValuesContent={(overflow) => `+${overflow} til`}
      searchable
      clearable
      {...props}
      data={toBranchTreeNodeData(branches ?? [])}
      value={field.state.value}
      onChange={field.handleChange}
      onBlur={field.handleBlur}
      error={field.state.meta.errors.join(", ")}
    />
  );
}
