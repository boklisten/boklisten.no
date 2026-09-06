import type { EmailValidationSource } from "@boklisten/backend/shared/email_validation";
import { TextInput } from "@mantine/core";
import type { TextInputProps } from "@mantine/core";
import { useState } from "react";
import validator from "validator";

import EmailDeliverabilityHint, {
  normalizeEmail,
} from "@/shared/components/form/fields/complex/EmailDeliverabilityHint";
import type { EmailDeliverabilityPerspective } from "@/shared/components/form/fields/complex/EmailDeliverabilityHint";
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

export default function EmailField({
  deliverabilityFeedback,
  ...props
}: TextInputProps & {
  /**
   * When set, the address is checked with SendGrid each time the field is left and any
   * deliverability concerns are shown underneath. Informational only; submission is unaffected.
   */
  deliverabilityFeedback?: {
    source: EmailValidationSource;
    perspective: EmailDeliverabilityPerspective;
  };
}) {
  const field = useFieldContext<string>();
  const [checkedEmail, setCheckedEmail] = useState("");
  const showHint =
    deliverabilityFeedback !== undefined && normalizeEmail(field.state.value) === checkedEmail;

  return (
    <>
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
        onBlur={() => {
          field.handleBlur();
          setCheckedEmail(normalizeEmail(field.state.value));
        }}
        error={field.state.meta.errors.join(", ")}
      />
      {showHint && (
        <EmailDeliverabilityHint
          email={checkedEmail}
          source={deliverabilityFeedback.source}
          perspective={deliverabilityFeedback.perspective}
          onApplySuggestion={(suggestion) => {
            field.handleChange(suggestion);
            setCheckedEmail(normalizeEmail(suggestion));
          }}
        />
      )}
    </>
  );
}
