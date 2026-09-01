import { List } from "@mantine/core";
import { Activity } from "react";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import { useFormContext } from "@/shared/hooks/form";

const NO_SERVER_ERRORS: string[] = [];

export default function ErrorSummary({
  serverErrors = NO_SERVER_ERRORS,
}: {
  serverErrors?: string[];
}) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => state.fieldMeta}>
      {(fieldMeta) => {
        const errors = new Set<string>([
          ...Object.values(fieldMeta).flatMap(
            // @ts-expect-error Object.values() does not retain type information
            (field) => field.errors,
          ),
          ...serverErrors,
        ]);

        return (
          <Activity mode={errors.size > 0 ? "visible" : "hidden"}>
            <ErrorAlert title="Du må rette opp følgende før du kan gå videre">
              <List size="sm">
                {[...errors].map((error) => (
                  <List.Item key={error}>{error}</List.Item>
                ))}
              </List>
            </ErrorAlert>
          </Activity>
        );
      }}
    </form.Subscribe>
  );
}
