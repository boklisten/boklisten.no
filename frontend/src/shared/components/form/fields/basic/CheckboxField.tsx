import { Checkbox } from "@mantine/core";
import type { CheckboxProps } from "@mantine/core";

import { commitValue, useFieldContext } from "@/shared/hooks/form";

export default function CheckboxField(props: CheckboxProps) {
  const field = useFieldContext<boolean>();

  return (
    <Checkbox
      {...props}
      checked={field.state.value}
      onChange={(event) => commitValue(field, event.currentTarget.checked)}
      onBlur={field.handleBlur}
      error={field.state.meta.errors.join(", ")}
    />
  );
}
