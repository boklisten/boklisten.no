import { Button, Stack } from "@mantine/core";
import { IconSend } from "@tabler/icons-react";
import type { Ref } from "react";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import { phoneNumberFieldValidator } from "@/shared/components/form/fields/complex/PhoneNumberField";
import { useAppForm } from "@/shared/hooks/form";

/** A number to send an SMS code to. */
export default function SmsPhoneForm({
  label,
  inputRef,
  focusFirst = false,
  error,
  pending,
  onSend,
}: {
  label: string;
  inputRef?: Ref<HTMLInputElement>;
  /** Marks the input for a modal's initial focus. */
  focusFirst?: boolean;
  error: string | null;
  pending: boolean;
  onSend: (phone: string) => void;
}) {
  const form = useAppForm({
    defaultValues: { phone: "" },
    onSubmit: ({ value }) => onSend(value.phone),
  });

  return (
    <Stack>
      <form.AppField
        name="phone"
        validators={{
          onSubmit: ({ value }) => phoneNumberFieldValidator(value, "personal"),
        }}
      >
        {(field) => (
          <field.PhoneNumberField
            label={label}
            ref={inputRef}
            data-autofocus={focusFirst || undefined}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void form.handleSubmit();
              }
            }}
          />
        )}
      </form.AppField>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <Button
        loading={pending}
        leftSection={<IconSend size={18} />}
        onClick={() => void form.handleSubmit()}
      >
        Send engangskode
      </Button>
    </Stack>
  );
}
