import { TextInput } from "@mantine/core";
import type { TextInputProps } from "@mantine/core";

import { useFieldContext } from "@/shared/hooks/form";

export default function TextField(props: TextInputProps) {
  const field = useFieldContext<string>();

  return (
    <TextInput
      {...props}
      value={field.state.value}
      onChange={(event) => field.handleChange(event.target.value)}
      onBlur={field.handleBlur}
      error={field.state.meta.errors.join(", ")}
    />
  );
}
