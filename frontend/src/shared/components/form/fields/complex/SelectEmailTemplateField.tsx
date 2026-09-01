import { Select } from "@mantine/core";
import type { SelectProps } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import { useFieldContext } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";

export default function SelectEmailTemplateField(props: SelectProps) {
  const field = useFieldContext<string | null>();
  const { api } = useApiClient();
  const { data: emailTemplates } = useQuery(api.dispatch.getEmailTemplates.queryOptions());

  return (
    <Select
      label="E-postmal"
      placeholder="Velg mal"
      data={
        emailTemplates?.map(({ id, name }) => ({
          label: name,
          value: id,
        })) ?? []
      }
      {...props}
      value={field.state.value}
      onChange={field.handleChange}
      onBlur={field.handleBlur}
      error={field.state.meta.errors.join(", ")}
    />
  );
}
