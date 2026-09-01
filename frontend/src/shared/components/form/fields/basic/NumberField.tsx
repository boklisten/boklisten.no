import { NumberInput } from "@mantine/core";
import type { NumberInputProps } from "@mantine/core";

import { useFieldContext } from "@/shared/hooks/form";

export default function NumberField(props: NumberInputProps) {
  const field = useFieldContext<number>();

  return (
    <NumberInput
      allowedDecimalSeparators={[",", "."]}
      decimalSeparator=","
      {...props}
      value={field.state.value}
      onChange={(value) => field.handleChange(Number(value))}
      onBlur={field.handleBlur}
    />
  );
}
