import { TextInput } from "@mantine/core";
import type { TextInputProps } from "@mantine/core";

import { useFieldContext } from "@/shared/hooks/form";

export function nameFieldValidator(value: string, context: string) {
  if (!value) {
    if (context === "personal") {
      return "Du må fylle inn ditt fulle navn";
    }
    if (context === "guardian") {
      return "Du må fylle inn foresatt sitt fulle navn";
    }
    if (context === "administrate") {
      return "Du må fylle inn kundens fulle navn";
    }
  }

  if (value.split(" ").length <= 1) {
    return "Du må fylle inn både fornavn og etternavn";
  }
  return null;
}

export default function NameField(props: TextInputProps) {
  const field = useFieldContext<string>();

  return (
    <TextInput
      required
      label="Fullt navn"
      placeholder="Solan Gundersen"
      autoComplete="name"
      {...props}
      value={field.state.value}
      onChange={(event) => field.handleChange(event.target.value)}
      onBlur={field.handleBlur}
      error={field.state.meta.errors.join(", ")}
    />
  );
}
