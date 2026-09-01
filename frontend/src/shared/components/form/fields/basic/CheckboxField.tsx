import { Checkbox } from "@mantine/core";
import type { CheckboxProps } from "@mantine/core";

import { useFieldContext } from "@/shared/hooks/form";

export default function CheckboxField(props: CheckboxProps) {
  const field = useFieldContext<boolean>();

  return (
    <Checkbox
      {...props}
      checked={field.state.value}
      onChange={(event) => field.handleChange(event.currentTarget.checked)}
      onBlur={field.handleBlur}
      error={field.state.meta.errors.join(", ")}
    />
  );
}
