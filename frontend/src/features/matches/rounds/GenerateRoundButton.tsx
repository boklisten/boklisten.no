import { Button, Card, Fieldset, Group, Modal, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Activity, useState } from "react";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { useAppForm } from "@/shared/hooks/form";
import { showSuccessNotification } from "@/shared/utils/notifications";

const asDate = (value: string) => dayjs(value).format("YYYY-MM-DD");

const SLOT_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]0$/;

const requireSlotTime = (value: string) => {
  if (!value) return "Du må velge et klokkeslett";
  if (!SLOT_TIME_PATTERN.test(value)) return "Klokkeslettet må være på et timinuttersintervall";
  return null;
};

interface GenerateFields {
  name: string;
  branches: string[];
  standLocation: string;
  deadlineBefore: string | null;
  includeCustomerItemsFromOtherBranches: boolean;
  meetingDate: string | null;
  userMeetingFrom: string;
  userMeetingTo: string;
  standFrom: string;
  standTo: string;
  userMatchLocations: { name: string }[];
}

export default function GenerateRoundButton({
  onGenerated,
}: {
  onGenerated: (roundId: string) => void;
}) {
  const { client, api } = useApiClient();
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const { data: branches } = useQuery(api.branches.getAll.queryOptions({}));

  const generateMutation = useMutation({
    mutationFn: async (values: GenerateFields) => {
      setApiError(null);
      if (!values.deadlineBefore) throw new Error("Du må velge en fristgrense");
      if (!values.meetingDate) throw new Error("Du må velge en dato for overleveringene");
      const locations = values.userMatchLocations
        .map((location) => location.name.trim())
        .filter((name) => name.length > 0);
      if (locations.length === 0) throw new Error("Du må legge til minst ett møtested");
      return client.api.matches.generate({
        timeout: 300_000,
        body: {
          name: values.name.trim(),
          branches: values.branches,
          standLocation: values.standLocation.trim(),
          deadlineBefore: asDate(values.deadlineBefore),
          includeCustomerItemsFromOtherBranches: values.includeCustomerItemsFromOtherBranches,
          meetingDate: asDate(values.meetingDate),
          userMeetingWindow: { from: values.userMeetingFrom, to: values.userMeetingTo },
          standWindow: { from: values.standFrom, to: values.standTo },
          userMatchLocations: locations,
        },
      });
    },
    onSuccess: (result) => {
      showSuccessNotification(
        `Laget ${result.userMatchCount} elevoverleveringer og ${result.standMatchCount} standoverleveringer. Runden er et utkast – skru den på når den ser riktig ut.`,
      );
      void queryClient.invalidateQueries({ queryKey: api.matchRounds.index.queryKey() });
      onGenerated(result.roundId);
      close();
    },
    onError: (error: Error) => setApiError(error.message),
  });

  const form = useAppForm({
    defaultValues: {
      name: "",
      branches: [],
      standLocation: "",
      deadlineBefore: null,
      includeCustomerItemsFromOtherBranches: false,
      meetingDate: null,
      userMeetingFrom: "",
      userMeetingTo: "",
      standFrom: "",
      standTo: "",
      userMatchLocations: [{ name: "" }],
    } as GenerateFields,
    onSubmit: ({ value }) => generateMutation.mutate(value),
  });

  return (
    <>
      <Button leftSection={<IconPlus size={16} />} onClick={open}>
        Ny runde
      </Button>
      <Modal opened={opened} onClose={close} title={"Generer ny runde"} size={"lg"}>
        <Stack>
          <Activity mode={apiError ? "visible" : "hidden"}>
            <ErrorAlert title={"Klarte ikke generere runden"}>{apiError}</ErrorAlert>
          </Activity>

          <form.AppField
            name={"name"}
            validators={{
              onBlur: ({ value }) => (value.trim().length === 0 ? "Runden må ha et navn" : null),
            }}
          >
            {(field) => (
              <field.TextField
                required
                label={"Navn på runden"}
                placeholder={"Ullern Vår 2026"}
                description={"Vises i nedtrekkslisten over runder"}
              />
            )}
          </form.AppField>

          <form.AppField
            name={"branches"}
            validators={{
              onBlur: ({ value }) => (value.length === 0 ? "Velg minst én filial" : null),
            }}
          >
            {(field) => (
              <field.MultiSelectField
                required
                searchable
                label={"Filialer"}
                placeholder={"Velg filialer"}
                nothingFoundMessage={"Fant ingen filialer"}
                data={(branches ?? []).map((branch) => ({
                  value: branch.id,
                  label: branch.name,
                }))}
              />
            )}
          </form.AppField>

          <form.AppField name={"deadlineBefore"}>
            {(field) => <field.DeadlinePickerField required label={"Ta med bøker med frist før"} />}
          </form.AppField>

          <form.AppField name={"includeCustomerItemsFromOtherBranches"}>
            {(field) => <field.CheckboxField label={"Ta med bøker delt ut ved andre filialer"} />}
          </form.AppField>

          <form.AppField
            name={"meetingDate"}
            validators={{
              onBlur: ({ value }) => (!value ? "Du må velge en dato" : null),
            }}
          >
            {(field) => (
              <field.DateField
                required
                label={"Dato for overleveringer"}
                description={"Alle overleveringer og stand-besøk skjer denne dagen"}
              />
            )}
          </form.AppField>

          <Fieldset legend={"Elevoverleveringer"}>
            <Stack>
              <Group grow>
                <form.AppField
                  name={"userMeetingFrom"}
                  validators={{ onBlur: ({ value }) => requireSlotTime(value) }}
                >
                  {(field) => <field.TimePickerField required label={"Fra"} />}
                </form.AppField>
                <form.AppField
                  name={"userMeetingTo"}
                  validators={{ onBlur: ({ value }) => requireSlotTime(value) }}
                >
                  {(field) => <field.TimePickerField required label={"Til"} />}
                </form.AppField>
              </Group>

              <form.AppField name={"userMatchLocations"} mode={"array"}>
                {(field) => (
                  <Stack>
                    <Text size={"sm"} fw={500}>
                      Møtesteder for elever
                    </Text>
                    {field.state.value.map((_, index) => (
                      <Card key={`location-${index}`} withBorder>
                        <Group align={"flex-end"}>
                          <form.AppField name={`userMatchLocations[${index}].name`}>
                            {(subField) => <subField.TextField label={"Sted"} />}
                          </form.AppField>
                          <Button
                            variant={"subtle"}
                            color={"red"}
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
                        variant={"default"}
                        leftSection={<IconPlus size={16} />}
                        onClick={() => field.setValue(field.state.value.concat([{ name: "" }]))}
                      >
                        Legg til møtested
                      </Button>
                    </Group>
                  </Stack>
                )}
              </form.AppField>
            </Stack>
          </Fieldset>

          <Fieldset legend={"Stand"}>
            <Stack>
              <form.AppField
                name={"standLocation"}
                validators={{
                  onBlur: ({ value }) =>
                    value.trim().length === 0 ? "Standen må ha et sted" : null,
                }}
              >
                {(field) => (
                  <field.TextField required label={"Sted for stand"} placeholder={"Kantina"} />
                )}
              </form.AppField>

              <Group grow>
                <form.AppField
                  name={"standFrom"}
                  validators={{ onBlur: ({ value }) => requireSlotTime(value) }}
                >
                  {(field) => <field.TimePickerField required label={"Standen åpner"} />}
                </form.AppField>
                <form.AppField
                  name={"standTo"}
                  validators={{ onBlur: ({ value }) => requireSlotTime(value) }}
                >
                  {(field) => <field.TimePickerField required label={"Standen stenger"} />}
                </form.AppField>
              </Group>
            </Stack>
          </Fieldset>

          <Group justify={"flex-end"}>
            <Button variant={"default"} onClick={close}>
              Avbryt
            </Button>
            <Button loading={generateMutation.isPending} onClick={form.handleSubmit}>
              Generer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
