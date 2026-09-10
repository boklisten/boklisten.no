import { formatBankAccount, normalizeBankAccount } from "@boklisten/backend/shared/bank_account";
import { TextInput } from "@mantine/core";
import type { TextInputProps } from "@mantine/core";

import { useFieldContext } from "@/shared/hooks/form";

export function bankAccountFieldValidator(value: string): string | null {
  if (!value.trim()) {
    return "Du må fylle inn kontonummer";
  }
  return normalizeBankAccount(value) === null
    ? "Du må fylle inn et gyldig norsk kontonummer (11 siffer)"
    : null;
}

/** A Norwegian bank account number, dotted the way it is printed on a bank card as it is typed. */
export default function BankAccountField(props: TextInputProps) {
  const field = useFieldContext<string>();

  return (
    <TextInput
      required
      label="Kontonummer"
      placeholder="1234.56.78903"
      autoComplete="off"
      inputMode="numeric"
      {...props}
      value={field.state.value}
      onChange={(event) => field.handleChange(formatBankAccount(event.target.value))}
      onBlur={field.handleBlur}
      error={field.state.meta.errors.join(", ")}
    />
  );
}
