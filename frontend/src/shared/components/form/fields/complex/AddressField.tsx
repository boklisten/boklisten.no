import { TextInput } from "@mantine/core";
import type { TextInputProps } from "@mantine/core";

import { useFieldContext } from "@/shared/hooks/form";

export function addressFieldValidator(value: string) {
  if (!value) {
    return "Du må fylle inn adresse";
  }
  return null;
}

export default function AddressField(props: TextInputProps) {
  const field = useFieldContext<string>();

  return (
    <TextInput
      required
      label="Adresse"
      placeholder="Flåklypatoppen 1"
      autoComplete="street-address"
      {...props}
      value={field.state.value}
      onChange={(event) => field.handleChange(event.target.value)}
      onBlur={field.handleBlur}
      error={field.state.meta.errors.join(", ")}
    />
  );
}
