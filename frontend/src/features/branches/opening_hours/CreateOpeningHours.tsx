import { Button, Group, Stack } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";

import { useAppForm } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";
import { parseNorwegianTime } from "@/shared/utils/dayjs";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

function combineDateAndTime(date: string, time: string) {
  return parseNorwegianTime(date, time).toISOString();
}

export default function CreateOpeningHours({ branchId }: { branchId: string }) {
  const { api } = useApiClient();
  const queryClient = useQueryClient();
  const createOpeningHourMutation = useMutation(
    api.openingHours.add.mutationOptions({
      onError: () => showErrorNotification("Klarte ikke legg til åpningstid"),
      onSuccess: () => {
        showSuccessNotification("Åpningstid ble lagt til!");
        form.reset();
      },
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: api.openingHours.get.queryKey({ params: { branchId } }),
        }),
    }),
  );
  const form = useAppForm({
    defaultValues: {
      date: "",
      start: "",
      end: "",
    },
    onSubmit: ({ value }) =>
      createOpeningHourMutation.mutate({
        body: {
          from: combineDateAndTime(value.date, value.start),
          to: combineDateAndTime(value.date, value.end),
          branchId,
        },
      }),
  });

  return (
    <Stack>
      <Group align={"start"}>
        <form.AppField
          name={"date"}
          validators={{
            onBlur: ({ value }) => (!value ? "Du må fylle inn dato" : null),
          }}
        >
          {(field) => (
            <field.DateField
              required
              minDate={new Date()}
              maxDate={dayjs().add(1, "year").toDate()}
              label={"Dato"}
              placeholder={"Velg dato"}
            />
          )}
        </form.AppField>
        <form.AppField
          name={"start"}
          validators={{
            onBlur: ({ value }) => (!value ? "Du må fylle inn starttidspunkt" : null),
          }}
        >
          {(field) => <field.TimePickerField required label={"Fra"} />}
        </form.AppField>
        <form.AppField
          name={"end"}
          validators={{
            onBlur: ({ value }) => (!value ? "Du må fylle inn slutttidspunkt" : null),
          }}
        >
          {(field) => <field.TimePickerField required label={"Til"} />}
        </form.AppField>
      </Group>
      <form.AppForm>
        <form.ErrorSummary />
      </form.AppForm>
      <Group>
        <Button onClick={form.handleSubmit} bg={"green"}>
          Legg til
        </Button>
      </Group>
    </Stack>
  );
}
