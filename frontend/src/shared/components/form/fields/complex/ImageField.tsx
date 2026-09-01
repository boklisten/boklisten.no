import { Stack, TextInput } from "@mantine/core";
import type { TextInputProps } from "@mantine/core";

import { useFieldContext } from "@/shared/hooks/form";
import { Activity } from "react";
import validator from "validator";

export function imageFieldValidator(value: string) {
  if (
    value &&
    !validator.isURL(value, {
      require_tld: import.meta.env["VITE_APP_ENV"] !== "dev",
      require_protocol: true,
    })
  ) {
    return "Du må fylle inn en gyldig lenke";
  }
  return null;
}

export default function ImageField(props: TextInputProps) {
  const field = useFieldContext<string>();

  return (
    <Stack gap="sm">
      <Activity
        mode={field.state.value && field.state.meta.errors.length === 0 ? "visible" : "hidden"}
      >
        <img
          style={{
            width: 250,
            maxWidth: "100%",
          }}
          src={field.state.value}
          alt="Ugyldig lenke"
        />
      </Activity>
      <TextInput
        label="Bildelenke"
        placeholder={`${import.meta.env["VITE_API_URL"]}/mitt_bilde.png`}
        autoComplete="photo"
        {...props}
        value={field.state.value}
        onChange={(event) => field.handleChange(event.target.value)}
        onBlur={field.handleBlur}
        error={field.state.meta.errors.join(", ")}
      />
    </Stack>
  );
}
