import { Loader, Text, TextInput } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { useFieldContext } from "@/shared/hooks/form";
import { showErrorNotification } from "@/shared/utils/notifications";
import { publicApiClient } from "@/shared/utils/publicApiClient";
import validator from "validator";

export async function postalCodeFieldValidator(value: string) {
  const illegalPostalCodeMessage = "Du må oppgi et gyldig norsk postnummer";
  if (!value || !validator.isPostalCode(value, "NO")) {
    return illegalPostalCodeMessage;
  }

  const postalCity = await publicApiClient.api.postal.lookupPostalCode({
    params: {
      postalCode: value,
    },
  });

  return postalCity ? null : illegalPostalCodeMessage;
}

export default function PostalCodeField() {
  const field = useFieldContext<{ code: string; city: string }>();
  const { code, city } = field.state.value;

  const lookupPostalCodeMutation = useMutation({
    mutationFn: async () => {
      if (!validator.isPostalCode(code, "NO")) {
        return null;
      }
      return publicApiClient.api.postal.lookupPostalCode({
        params: {
          postalCode: code,
        },
      });
    },
    onSettled: (result) => field.setValue({ code, city: result ?? "" }),
    onError: () => showErrorNotification("Klarte ikke laste inn poststed"),
  });

  let postalCityHint: ReactNode = null;
  if (city) {
    postalCityHint = <Text size="sm">{city}</Text>;
  } else if (lookupPostalCodeMutation.isPending) {
    postalCityHint = <Loader size="xs" />;
  }

  return (
    <TextInput
      required
      label="Postnummer"
      placeholder="2560"
      autoComplete="postal-code"
      inputMode="numeric"
      rightSectionWidth={city ? city.length * 10 : 30}
      rightSection={postalCityHint}
      value={code}
      onChange={async (event) => {
        field.setValue({ code: event.target.value, city: "" }, { dontValidate: true });
        lookupPostalCodeMutation.mutate();
      }}
      onBlur={field.handleBlur}
      error={field.state.meta.errors.join(", ")}
    />
  );
}
