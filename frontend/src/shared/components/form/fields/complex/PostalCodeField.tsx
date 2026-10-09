import { Loader, Text, TextInput } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { useFieldContext } from "@/shared/hooks/form";
import { fetchPostalCity, postalCityQuery } from "@/shared/utils/postalCity";
import { showErrorNotification } from "@/shared/utils/notifications";

export async function postalCodeFieldValidator(value: string) {
  const postalCity = await fetchPostalCity(value);
  return postalCity ? null : "Du må oppgi et gyldig norsk postnummer";
}

/** A postal code, with the city it belongs to shown inside the input. */
export default function PostalCodeField() {
  const field = useFieldContext<string>();
  const queryClient = useQueryClient();
  const code = field.state.value;
  const cityQuery = useQuery(postalCityQuery(code));
  const city = cityQuery.data ?? null;

  let postalCityHint: ReactNode = null;
  if (city) {
    postalCityHint = <Text size="sm">{city}</Text>;
  } else if (cityQuery.isFetching) {
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
        const typed = event.target.value;
        field.setValue(typed, { dontValidate: true });
        try {
          // A code with a known city is complete, so the field is done without waiting for a blur.
          const typedCity = await queryClient.query(postalCityQuery(typed));
          if (typedCity && field.form.getFieldValue(field.name) === typed) {
            field.handleBlur();
          }
        } catch {
          showErrorNotification("Klarte ikke laste inn poststed");
        }
      }}
      onBlur={field.handleBlur}
      error={field.state.meta.errors.join(", ")}
    />
  );
}
