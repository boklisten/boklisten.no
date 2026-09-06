import { MultiSelect } from "@mantine/core";
import type { MultiSelectProps } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import { useFieldContext } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";
import { itemSelectFilter, toItemSelectData } from "@/shared/utils/itemSelectFilter";

export default function SelectItemsField(props: MultiSelectProps) {
  const field = useFieldContext<{ id: string; title: string }[]>();
  const { api } = useApiClient();
  const { data: items } = useQuery(api.items.get.queryOptions());

  return (
    <MultiSelect
      label="Bøker"
      placeholder="Velg bøker"
      searchable
      clearable
      description="Søk etter tittel eller ISBN"
      data={toItemSelectData(items)}
      filter={itemSelectFilter(items)}
      {...props}
      value={field.state.value.map((v) => v.id)}
      onChange={(values) =>
        field.handleChange(
          values.map((itemId) => ({
            id: itemId,
            title: items?.find((item) => item.id === itemId)?.title ?? "",
          })),
        )
      }
      onBlur={field.handleBlur}
      error={field.state.meta.errors.join(", ")}
    />
  );
}
