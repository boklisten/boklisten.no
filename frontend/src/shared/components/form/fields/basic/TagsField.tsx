import { TagsInput } from "@mantine/core";
import type { TagsInputProps } from "@mantine/core";

import { useFieldContext } from "@/shared/hooks/form";

export default function TagsField(props: TagsInputProps) {
  const field = useFieldContext<string[]>();

  return (
    <TagsInput
      {...props}
      value={field.state.value}
      onChange={field.handleChange}
      onBlur={field.handleBlur}
      error={field.state.meta.errors.join(", ")}
    />
  );
}
