import { Autocomplete } from "@mantine/core";
import type { AutocompleteProps } from "@mantine/core";

import { useFieldContext } from "@/shared/hooks/form";

export default function AutocompleteField(props: AutocompleteProps) {
  const field = useFieldContext<string>();

  return (
    <Autocomplete
      {...props}
      value={field.state.value}
      onChange={field.handleChange}
      onBlur={field.handleBlur}
      error={field.state.meta.errors.join(", ")}
    />
  );
}
