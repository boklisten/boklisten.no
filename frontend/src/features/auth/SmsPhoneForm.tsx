import { Button, Stack } from "@mantine/core";
import { useMergedRef } from "@mantine/hooks";
import { IconSend } from "@tabler/icons-react";
import { useRef } from "react";
import type { Ref } from "react";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import { phoneNumberFieldValidator } from "@/shared/components/form/fields/complex/PhoneNumberField";
import { useAppForm } from "@/shared/hooks/form";

/**
 * A number to send an SMS code to. The field keeps focus while the code goes out, so the
 * keyboard is already up when the code boxes take over: iOS only opens it for a focus() inside
 * the tap, and the boxes mount after the request.
 */
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
  const ownInput = useRef<HTMLInputElement>(null);
  const input = useMergedRef(ownInput, inputRef);
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
            ref={input}
            // 16px text, or iOS zooms the page when the field gets focus.
            size="md"
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
        size="md"
        loading={pending}
        leftSection={<IconSend size={18} />}
        onClick={() => {
          // Inside the tap, so iOS brings the keyboard back if tapping the button closed it.
          ownInput.current?.focus();
          void form.handleSubmit();
        }}
      >
        Send engangskode
      </Button>
    </Stack>
  );
}
