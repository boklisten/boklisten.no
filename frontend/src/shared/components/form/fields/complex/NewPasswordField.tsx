import { PasswordInput, Stack } from "@mantine/core";
import type { PasswordInputProps } from "@mantine/core";
import PasswordStrengthBarImport from "react-password-strength-bar";

import { useFieldContext } from "@/shared/hooks/form";

/**
 * The package is CommonJS with `exports.default`: Vite's browser interop hands us the module
 * object with the component on `.default`, while Bun's interop during server rendering hands us
 * the component itself. Accept either, so the page also renders on the server.
 */
const PasswordStrengthBar: typeof PasswordStrengthBarImport =
  typeof PasswordStrengthBarImport === "function"
    ? PasswordStrengthBarImport
    : Reflect.get(PasswordStrengthBarImport, "default");

export function newPasswordFieldValidator(value: string) {
  if (!value) {
    return "Du må fylle inn et passord";
  }
  if (value.length < 10) {
    return "Passordet må ha minst 10 tegn";
  }

  return null;
}

export default function NewPasswordField(props: PasswordInputProps) {
  const field = useFieldContext<string>();
  return (
    <Stack gap={2}>
      <PasswordInput
        required
        label="Passord"
        type="password"
        autoComplete="new-password"
        placeholder="correct horse battery staple"
        {...props}
        value={field.state.value}
        onChange={(event) => field.handleChange(event.target.value)}
        onBlur={field.handleBlur}
        error={field.state.meta.errors.join(", ")}
      />
      <PasswordStrengthBar
        password={field.state.value}
        minLength={10}
        shortScoreWord="for kort"
        scoreWords={["svakt", "svakt", "ok", "stekt", "veldig sterkt"]}
      />
    </Stack>
  );
}
