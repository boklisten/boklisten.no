import { MultiSelect } from "@mantine/core";
import type { MultiSelectProps } from "@mantine/core";

import { useFieldContext } from "@/shared/hooks/form";

export default function MultiSelectField(props: MultiSelectProps) {
  const field = useFieldContext<string[]>();

  return (
    <MultiSelect
      {...props}
      value={field.state.value}
      onChange={field.handleChange}
      onBlur={field.handleBlur}
      error={field.state.meta.errors.join(", ")}
    />
  );
}
