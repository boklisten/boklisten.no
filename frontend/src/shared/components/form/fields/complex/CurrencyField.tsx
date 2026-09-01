import { NumberInput } from "@mantine/core";
import type { NumberInputProps } from "@mantine/core";

import { useFieldContext } from "@/shared/hooks/form";

export default function CurrencyField(props: NumberInputProps) {
  const field = useFieldContext<string>();

  return (
    <NumberInput
      allowLeadingZeros={false}
      allowNegative={false}
      allowedDecimalSeparators={[",", "."]}
      decimalScale={2}
      decimalSeparator=","
      {...props}
      value={field.state.value}
      onChange={(value) => field.handleChange(value.toString())}
      onBlur={field.handleBlur}
    />
  );
}
