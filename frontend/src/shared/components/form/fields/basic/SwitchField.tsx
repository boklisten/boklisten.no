import { Switch } from "@mantine/core";
import type { SwitchProps } from "@mantine/core";

import { useFieldContext } from "@/shared/hooks/form";

export default function SwitchField(props: SwitchProps) {
  const field = useFieldContext<boolean>();

  return (
    <Switch
      {...props}
      checked={field.state.value}
      onChange={(event) => field.handleChange(event.currentTarget.checked)}
      onBlur={field.handleBlur}
      error={field.state.meta.errors.join(", ")}
    />
  );
}
