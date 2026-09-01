import { DateTimePicker } from "@mantine/dates";
import type { DateTimePickerProps } from "@mantine/dates";

import { useFieldContext } from "@/shared/hooks/form";

export default function DateTimePickerField(props: DateTimePickerProps) {
  const field = useFieldContext<string | null>();
  return (
    <DateTimePicker
      {...props}
      value={field.state.value}
      onChange={field.handleChange}
      onBlur={field.handleBlur}
      error={field.state.meta.errors.join(", ")}
    />
  );
}
