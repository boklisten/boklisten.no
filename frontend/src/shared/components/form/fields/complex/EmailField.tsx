import { TextInput } from "@mantine/core";
import type { TextInputProps } from "@mantine/core";
import validator from "validator";

import { useFieldContext } from "@/shared/hooks/form";

export function emailFieldValidator(value: string, context: string, primaryEmail?: string) {
  if (!value) {
    if (context === "personal" || context === "administrate") {
      return "Du må fylle inn e-post";
    }
    if (context === "guardian") {
      return "Du må fylle inn foresatt sin e-post";
    }
  }

  if (!validator.isEmail(value)) {
    if (context === "personal" || context === "administrate") {
      return "Du må fylle inn en gyldig e-post";
    }
    if (context === "guardian") {
      return "Du må fylle inn en gyldig e-post for foresatt";
    }
  }

  if (context === "guardian" && value === primaryEmail) {
    return `Foresatt sin e-post må være forskjellig fra kontoens e-post (${primaryEmail})`;
  }

  return null;
}

export default function EmailField(props: TextInputProps) {
  const field = useFieldContext<string>();

  return (
    <TextInput
      required
      label="E-post"
      placeholder="solan.gundersen@outlook.com"
      autoComplete="email"
      inputMode="email"
      type="email"
      {...props}
      value={field.state.value}
      onChange={(event) => field.handleChange(event.target.value)}
      onBlur={field.handleBlur}
      error={field.state.meta.errors.join(", ")}
    />
  );
}
