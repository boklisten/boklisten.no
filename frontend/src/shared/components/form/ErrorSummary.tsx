import { List } from "@mantine/core";
import { Activity } from "react";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import { useFormContext } from "@/shared/hooks/form";

export default function ErrorSummary({ serverErrors = [] }: { serverErrors?: string[] }) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => state.fieldMeta}>
      {(fieldMeta) => {
        const errors = [
          ...Object.values(fieldMeta).flatMap(
            // @ts-expect-error Object.values() does not retain type information
            (field) => field.errors,
          ),
          ...serverErrors,
        ];

        return (
          <Activity mode={errors.length > 0 ? "visible" : "hidden"}>
            <ErrorAlert title="Du må rette opp følgende før du kan gå videre">
              <List size="sm">
                {errors.map((error, i) => (
                  <List.Item key={`err-${i}`}>{error}</List.Item>
                ))}
              </List>
            </ErrorAlert>
          </Activity>
        );
      }}
    </form.Subscribe>
  );
}
