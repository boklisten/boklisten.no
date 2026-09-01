import { Button, Card, Fieldset, Group, Modal, Stack, Text } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Activity, useState } from "react";

import { SLOT_TIME_PATTERN } from "@boklisten/backend/shared/match/match-round-dto";

import ExcludedCustomersField from "@/features/matches/rounds/ExcludedCustomersField";
import { useRefreshRounds } from "@/features/matches/rounds/useRounds";
import type { Round } from "@/features/matches/rounds/useRounds";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import { useAppForm } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";
import { showSuccessNotification } from "@/shared/utils/notifications";

const asDate = (value: string) => dayjs(value).format("YYYY-MM-DD");

const requireSlotTime = (value: string) => {
  if (!value) {
    return "Du må velge et klokkeslett";
  }
  if (!SLOT_TIME_PATTERN.test(value)) {
    return "Klokkeslettet må være på et timinuttersintervall";
  }
  return null;
};

/** Zero-padded `HH:MM` sorts as plain strings, so "ends after it starts" is a comparison. */
const requireEndAfter = (value: string, start: string) =>
  requireSlotTime(value) ?? (start && value <= start ? "Sluttiden må være etter starttiden" : null);

interface PlanFields {
  name: string;
  branches: string[];
  standLocation: string;
  deadline: string | null;
  includeCustomerItemsFromOtherBranches: boolean;
  meetingDate: string | null;
  userMeetingFrom: string;
  userMeetingTo: string;
  standFrom: string;
  standTo: string;
  userMatchLocations: { name: string }[];
  excludedCustomerIds: string[];
}

const emptyPlan: PlanFields = {
  name: "",
  branches: [],
  standLocation: "",
  deadline: null,
  includeCustomerItemsFromOtherBranches: false,
  meetingDate: null,
  userMeetingFrom: "",
  userMeetingTo: "",
  standFrom: "",
  standTo: "",
  userMatchLocations: [{ name: "" }],
  excludedCustomerIds: [],
};

function planOf(round: Round): PlanFields {
  return {
    name: round.name,
    branches: round.branches,
    standLocation: round.standLocation,
    deadline: round.deadline,
    includeCustomerItemsFromOtherBranches: round.includeCustomerItemsFromOtherBranches,
    meetingDate: round.meetingDate,
    userMeetingFrom: round.userMeetingFrom,
    userMeetingTo: round.userMeetingTo,
    standFrom: round.standFrom,
    standTo: round.standTo,
    userMatchLocations: round.userMatchLocations.map((name) => ({ name })),
    excludedCustomerIds: round.excludedCustomerIds,
  };
}

/**
 * Plans a round, or edits a plan that has not been generated yet.
 *
 * Planning does not make any matches. An admin fills this in, checks the plan over, and generates
 * from it as a separate step — so a mistyped date costs an edit rather than a round full of wrong
 * meetings.
 *
 * Rendered only while it is open, rather than kept mounted behind an `opened` flag: the form reads
 * its starting values once, so a mounted modal would keep showing the first round it was opened
 * for.
 */
export default function PlanRoundModal({
  round,
  onClose,
  onSaved,
}: {
  /** The round being edited, or undefined when planning a new one. */
  round?: Round;
  onClose: () => void;
  onSaved: (roundId: string) => void;
}) {
  const { client } = useApiClient();
  const refreshRounds = useRefreshRounds();
  const [apiError, setApiError] = useState<string | null>(null);
  const editing = round !== undefined;

  const saveMutation = useMutation({
    mutationFn: async (values: PlanFields) => {
      setApiError(null);
      if (!values.deadline) {
        throw new Error("Du må velge en frist");
      }
      if (!values.meetingDate) {
        throw new Error("Du må velge en dato for overleveringene");
      }
      const locations = values.userMatchLocations
        .map((location) => location.name.trim())
        .filter((name) => name.length > 0);
      if (locations.length === 0) {
        throw new Error("Du må legge til minst ett møtested");
      }

      const body = {
        name: values.name.trim(),
        branches: values.branches,
        standLocation: values.standLocation.trim(),
        deadline: asDate(values.deadline),
        includeCustomerItemsFromOtherBranches: values.includeCustomerItemsFromOtherBranches,
        meetingDate: asDate(values.meetingDate),
        userMeetingFrom: values.userMeetingFrom,
        userMeetingTo: values.userMeetingTo,
        standFrom: values.standFrom,
        standTo: values.standTo,
        userMatchLocations: locations,
        excludedCustomerIds: values.excludedCustomerIds,
      };

      return round
        ? client.api.matchRounds.update({ params: { id: round.id }, body })
        : client.api.matchRounds.store({ body });
    },
    onSuccess: (result) => {
      showSuccessNotification(
        editing
          ? "Planen ble lagret"
          : "Runden ble planlagt. Generer overleveringene når du er klar.",
      );
      refreshRounds();
      onSaved(result.id);
      onClose();
    },
    onError: (error: Error) => setApiError(error.message),
  });

  const form = useAppForm({
    defaultValues: round ? planOf(round) : emptyPlan,
    onSubmit: ({ value }) => saveMutation.mutate(value),
  });

  return (
    <Modal
      opened
      onClose={onClose}
      title={editing ? "Rediger planen" : "Planlegg ny runde"}
      size="lg"
    >
      <Stack>
        <Activity mode={apiError ? "visible" : "hidden"}>
          <ErrorAlert title={editing ? "Klarte ikke lagre planen" : "Klarte ikke planlegge runden"}>
            {apiError}
          </ErrorAlert>
        </Activity>

        <form.AppField
          name="name"
          validators={{
            onBlur: ({ value }) => (value.trim().length === 0 ? "Runden må ha et navn" : null),
          }}
        >
          {(field) => (
            <field.TextField
              required
              label="Navn på runden"
              placeholder="Ullern Vår 2026"
              description="Vises i nedtrekkslisten over runder"
            />
          )}
        </form.AppField>

        <form.AppField
          name="branches"
          validators={{
            onBlur: ({ value }) => (value.length === 0 ? "Velg minst én filial" : null),
          }}
        >
          {(field) => <field.SelectBranchesField required />}
        </form.AppField>

        <form.AppField name="deadline">
          {(field) => (
            <field.DeadlinePickerField
              required
              label="Frist på bøkene"
              description="Runden tar med bøker som har frist på denne datoen"
            />
          )}
        </form.AppField>

        <form.AppField name="includeCustomerItemsFromOtherBranches">
          {(field) => <field.CheckboxField label="Ta med bøker delt ut ved andre filialer" />}
        </form.AppField>

        <Fieldset legend="Ekskluderte elever">
          <Stack>
            <Text size="sm" c="dimmed">
              Disse elevene holdes helt utenfor runden og får ingen overleveringer.
            </Text>
            <form.AppField name="excludedCustomerIds">
              {(field) => (
                <ExcludedCustomersField value={field.state.value} onChange={field.setValue} />
              )}
            </form.AppField>
          </Stack>
        </Fieldset>

        <form.AppField
          name="meetingDate"
          validators={{
            onBlur: ({ value }) => (!value ? "Du må velge en dato" : null),
          }}
        >
          {(field) => (
            <field.DateField
              required
              label="Dato for overleveringer"
              description="Alle overleveringer og stand-besøk skjer denne dagen"
            />
          )}
        </form.AppField>

        <Fieldset legend="Elevoverleveringer">
          <Stack>
            <Group grow>
              <form.AppField
                name="userMeetingFrom"
                validators={{ onBlur: ({ value }) => requireSlotTime(value) }}
              >
                {(field) => <field.TimePickerField required label="Fra" />}
              </form.AppField>
              <form.AppField
                name="userMeetingTo"
                validators={{
                  onBlur: ({ value, fieldApi }) =>
                    requireEndAfter(value, fieldApi.form.getFieldValue("userMeetingFrom")),
                }}
              >
                {(field) => <field.TimePickerField required label="Til" />}
              </form.AppField>
            </Group>

            <form.AppField name="userMatchLocations" mode="array">
              {(field) => (
                <Stack>
                  <Text size="sm" fw={500}>
                    Møtesteder for elever
                  </Text>
                  {field.state.value.map((_, index) => (
                    <Card key={`location-${index}`} withBorder>
                      <Group align="flex-end">
                        <form.AppField name={`userMatchLocations[${index}].name`}>
                          {(subField) => <subField.TextField label="Sted" />}
                        </form.AppField>
                        <Button
                          variant="subtle"
                          color="red"
                          leftSection={<IconTrash size={16} />}
                          disabled={field.state.value.length === 1}
                          onClick={() => field.setValue(field.state.value.toSpliced(index, 1))}
                        >
                          Fjern
                        </Button>
                      </Group>
                    </Card>
                  ))}
                  <Group>
                    <Button
                      variant="default"
                      leftSection={<IconPlus size={16} />}
                      onClick={() => field.setValue([...field.state.value, { name: "" }])}
                    >
                      Legg til møtested
                    </Button>
                  </Group>
                </Stack>
              )}
            </form.AppField>
          </Stack>
        </Fieldset>

        <Fieldset legend="Stand">
          <Stack>
            <form.AppField
              name="standLocation"
              validators={{
                onBlur: ({ value }) => (value.trim().length === 0 ? "Standen må ha et sted" : null),
              }}
            >
              {(field) => <field.TextField required label="Sted for stand" placeholder="Kantina" />}
            </form.AppField>

            <Group grow>
              <form.AppField
                name="standFrom"
                validators={{ onBlur: ({ value }) => requireSlotTime(value) }}
              >
                {(field) => <field.TimePickerField required label="Standen åpner" />}
              </form.AppField>
              <form.AppField
                name="standTo"
                validators={{
                  onBlur: ({ value, fieldApi }) =>
                    requireEndAfter(value, fieldApi.form.getFieldValue("standFrom")),
                }}
              >
                {(field) => <field.TimePickerField required label="Standen stenger" />}
              </form.AppField>
            </Group>
          </Stack>
        </Fieldset>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Avbryt
          </Button>
          <Button loading={saveMutation.isPending} onClick={form.handleSubmit}>
            {editing ? "Lagre planen" : "Planlegg runden"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
