import { MultiSelect } from "@mantine/core";
import type { MultiSelectProps } from "@mantine/core";

import { commitValue, useFieldContext } from "@/shared/hooks/form";

export default function MultiSelectField(props: MultiSelectProps) {
  const field = useFieldContext<string[]>();

  return (
    <MultiSelect
      {...props}
      value={field.state.value}
      onChange={(value) => commitValue(field, value)}
      onBlur={field.handleBlur}
      error={field.state.meta.errors.join(", ")}
    />
  );
}
