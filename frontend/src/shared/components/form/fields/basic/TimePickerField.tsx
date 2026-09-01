import { TimePicker } from "@mantine/dates";
import type { TimePickerProps } from "@mantine/dates";

import { useFieldContext } from "@/shared/hooks/form";

export default function TimePickerField(props: TimePickerProps) {
  const field = useFieldContext<string>();
  return (
    <TimePicker
      {...props}
      value={field.state.value}
      onChange={field.handleChange}
      onBlur={field.handleBlur}
      error={field.state.meta.errors.join(", ")}
    />
  );
}
