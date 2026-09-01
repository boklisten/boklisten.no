import { Select } from "@mantine/core";
import type { SelectProps } from "@mantine/core";

import { useFieldContext } from "@/shared/hooks/form";

export default function SelectField(props: SelectProps) {
  const field = useFieldContext<string | null>();

  return (
    <Select
      {...props}
      value={field.state.value}
      onChange={field.handleChange}
      onBlur={field.handleBlur}
      error={field.state.meta.errors.join(", ")}
    />
  );
}
